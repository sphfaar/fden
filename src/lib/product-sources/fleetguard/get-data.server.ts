import type { GetNextProducts, GetProducts } from '../types';
import type FleetguardPartsResponse from './response1-schema';
import type { FleetguardPartsPayload } from './response1-schema';
import type FleetguardSchema from './response-schema';
import type { FleetguardItem, FleetguardSpec, FleetguardSpecResponse } from './response-schema';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const CATALOG_ORIGIN = 'https://www.fleetguard.com';
const APEX_URL = `${CATALOG_ORIGIN}/webruntime/api/apex/execute?asGuest=true&htmlEncode=false&language=en-US`;
const SEARCH_CLASS = 'GlobalSearchController';
const SPEC_CLASS = 'Saltbox_ProductDetailPageController';
// getProductImages issues one SOQL query per row and fails at 101.
const PAGE_CAP = 100;
const SPEC_CONCURRENCY = 8;
const MILLIMETERS = /(\d+(?:[.,]\d+)?)\s*mm\b/i;
const TWA_MICRON = /^TWA MICRON @ BETA=(\d+(?:\.\d+)?)$/i;
const BETA_SIZE = /^Particle Size at Beta (\d+(?:\.\d+)?)$/i;
const PRIMARY_EFFICIENCY = 'Primary Particle Efficiency';

interface SpecRow {
	label: string;
	value: string;
}

const catalogHeaders = {
	...headers,
	Accept: '*/*',
	'Accept-Language': 'en-US,en;q=0.9',
	Origin: CATALOG_ORIGIN,
	Referer: `${CATALOG_ORIGIN}/results`
};

function apexBody(classname: string, method: string, parameters: object) {
	return {
		namespace: '',
		classname,
		method,
		isContinuation: false,
		params: parameters,
		cacheable: false
	};
}

// www.fleetguard.com is on Cloudflare. A Worker subrequest is handed to that zone as HTTP,
// Salesforce answers 301 to the same https URL, and following it loops. Axios uses Node's
// redirect client, whose response has no `.req` on workerd, so the first hop throws
// ERR_FR_REDIRECTION_FAILURE. fetch with redirect manual keeps the 301 instead of throwing.
async function catalogPost<T>(body: object): Promise<{ status: number; data: T | undefined }> {
	let url = APEX_URL;
	const payload = JSON.stringify(body);
	for (let hop = 0; hop < 4; hop++) {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				...catalogHeaders,
				Accept: 'application/json',
				'Content-Type': 'application/json; charset=utf-8'
			},
			body: payload,
			redirect: 'manual'
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			await response.body?.cancel();
			let next: URL | undefined;
			try {
				next = location ? new URL(location, url) : undefined;
			} catch {
				next = undefined;
			}
			if (!next || next.href === new URL(url).href) {
				console.error(
					'Fleetguard redirect loop',
					url,
					'Worker subrequests to this zone are redirected to the same URL'
				);
				return { status: 502, data: undefined };
			}
			url = next.href;
			continue;
		}
		if (response.status >= 400) {
			await response.body?.cancel();
			return { status: response.status, data: undefined };
		}
		try {
			return { status: response.status, data: (await response.json()) as T };
		} catch (error) {
			console.error('Fleetguard JSON', url, error);
			return { status: 502, data: undefined };
		}
	}
	return { status: 502, data: undefined };
}

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function partIds(body: FleetguardPartsResponse): string[] {
	const raw: unknown = body.returnValue;
	let payload: FleetguardPartsPayload | undefined;
	if (typeof raw === 'string') payload = JSON.parse(raw) as FleetguardPartsPayload;
	else if (raw && typeof raw === 'object') payload = raw as FleetguardPartsPayload;
	if (!payload?.products) return [];
	const ids: string[] = [];
	for (const product of payload.products) {
		const id = text(product.Id);
		if (id) ids.push(id);
	}
	return ids;
}

function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = MILLIMETERS.exec(value);
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	// The catalog stores a missing size as "0.00 inch / 0.00 mm" and hides that row.
	return parsed === 0 || !Number.isFinite(parsed) ? undefined : parsed;
}

function specRows(raw: FleetguardSpecResponse['returnValue']): SpecRow[] {
	let value: unknown = raw;
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(value)) return [];
	const rows: SpecRow[] = [];
	for (const item of value) {
		if (!item || typeof item !== 'object') continue;
		const record = item as FleetguardSpec;
		const label =
			text(record.displayName?.Trasnlatedlanguage__c) ??
			text(record.specName) ??
			text(record.displayName?.Spec_Name__c);
		const specValue = text(record.specValue);
		if (!label || !specValue || label === 'Applicable Region') continue;
		rows.push({ label, value: specValue });
	}
	return rows;
}

function efficiencyText(rows: readonly SpecRow[]): string | undefined {
	const parts: { order: number; text: string }[] = [];
	for (const row of rows) {
		const leading = /^(\d+(?:\.\d+)?)/.exec(row.value);
		if (leading && Number(leading[1]) === 0) continue;
		if (row.label === PRIMARY_EFFICIENCY) {
			parts.push({ order: -1, text: row.value });
			continue;
		}
		const twa = TWA_MICRON.exec(row.label);
		if (twa) {
			parts.push({ order: Number(twa[1]), text: `${row.value} @ β=${twa[1]}` });
			continue;
		}
		const beta = BETA_SIZE.exec(row.label);
		if (beta) parts.push({ order: Number(beta[1]), text: `${row.value} @ β=${beta[1]}` });
	}
	if (parts.length === 0) return undefined;
	parts.sort((left, right) => left.order - right.order);
	return parts.map((part) => part.text).join('; ');
}

function applySpecs(product: Product, rows: readonly SpecRow[]): void {
	const byLabel = new Map(rows.map((row) => [row.label, row.value]));
	// Length is the axial size on elements that do not publish Height.
	const height = millimeters(
		byLabel.get('Height') ?? byLabel.get('Overall Height') ?? byLabel.get('Length')
	);
	const externalDiameter = millimeters(byLabel.get('Largest Outside Diameter'));
	const internalDiameter = millimeters(byLabel.get('Largest End Inside Diameter'));
	const threadSize = text(byLabel.get('Thread Size'));
	const gasketExternalDiameter = millimeters(byLabel.get('Gasket Outside Diameter'));
	const gasketInternalDiameter = millimeters(byLabel.get('Gasket Inside Diameter'));
	if (
		height !== undefined ||
		externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		threadSize !== undefined ||
		gasketExternalDiameter !== undefined ||
		gasketInternalDiameter !== undefined
	) {
		product.dimensions = {};
		if (externalDiameter !== undefined) product.dimensions.externalDiameter = externalDiameter;
		if (internalDiameter !== undefined) product.dimensions.internalDiameter = internalDiameter;
		if (height !== undefined) product.dimensions.height = height;
		if (threadSize !== undefined) product.dimensions.threadSize = threadSize;
		if (gasketExternalDiameter !== undefined)
			product.dimensions.gasketExternalDiameter = gasketExternalDiameter;
		if (gasketInternalDiameter !== undefined)
			product.dimensions.gasketInternalDiameter = gasketInternalDiameter;
	}

	const mediaType = text(byLabel.get('Media Type'));
	const efficiency = efficiencyText(rows);
	if (!mediaType && !efficiency) return;
	product.specs = {};
	if (mediaType) product.specs.mediaType = mediaType;
	if (efficiency) product.specs.efficiency = efficiency;
}

async function addSpecifications(productsById: Map<string, Product[]>): Promise<void> {
	if (productsById.size === 0) return;
	const pending = productsById[Symbol.iterator]();

	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [id, products] = next.value;
			try {
				const response = await catalogPost<FleetguardSpecResponse>(
					apexBody(SPEC_CLASS, 'retrieveProductSpecifications', {
						productId: id,
						language: 'en-US'
					})
				);
				if (response.status >= 400 || !response.data) continue;
				const rows = specRows(response.data.returnValue);
				for (const product of products) applySpecs(product, rows);
			} catch (error) {
				console.error('fleetguard specifications', id, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(SPEC_CONCURRENCY, productsById.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

function toProduct(row: FleetguardItem, productsById: Map<string, Product[]>): Product {
	const details = row.productDetailsWrapper;
	const name = text(details?.productName);
	const id = text(details?.productId);
	const product: Product = {
		manufacturer: text(details?.eqManufacturer) ?? '',
		manufacturer_code: text(details?.competitorPN) ?? text(details?.crossReferenceName) ?? '',
		source_reference_code: name ?? text(details?.LongPartNo) ?? ''
	};
	const description = text(details?.shortDescription);
	if (description) product.description = description;
	const longDescription = text(details?.longDescription);
	if (longDescription) product.longDescription = longDescription;
	const category = text(details?.productFamilyName) ?? text(details?.productFamily);
	if (category) product.category = category;
	if (name && id) {
		const detailsUrl = catalogHttpsUrl(
			`${CATALOG_ORIGIN}/product/${encodeURIComponent(name.toLowerCase())}/${encodeURIComponent(id)}`
		);
		if (detailsUrl) product.detailsUrl = detailsUrl;
	}
	const thumbnail = catalogHttpsUrl(row.imageUrl, `${CATALOG_ORIGIN}/`);
	if (thumbnail) product.thumbnails = [thumbnail];
	if (id) {
		const products = productsById.get(id) ?? [];
		products.push(product);
		productsById.set(id, products);
	}
	return product;
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const started = config?.showPerfReqProxyToSource ? Date.now() : undefined;
	const productsById = new Map<string, Product[]>();

	try {
		const listed = await catalogPost<FleetguardPartsResponse>(
			apexBody(SEARCH_CLASS, 'fetchProductsFromParts', { searchTerm: code })
		);
		if (listed.status >= 400 || !listed.data) {
			return {
				meta: {
					status: listed.status >= 400 ? listed.status : 502,
					currentItemsDisplayed: 0,
					page: 0
				},
				products: []
			};
		}

		const ids = partIds(listed.data);
		if (ids.length === 0) {
			const elapsed = started === undefined ? undefined : Date.now() - started;
			return {
				meta: {
					status: listed.status,
					currentItemsDisplayed: 0,
					totalItems: 0,
					page: safePage,
					pages: 0,
					maxItemsPagination: pageSize,
					performanceTimings: elapsed === undefined ? undefined : { proxyToSource: elapsed }
				},
				products: []
			};
		}

		const detailsStarted = config?.showPerfReqProxyToSource ? Date.now() : undefined;
		const details = await catalogPost<FleetguardSchema>(
			apexBody(SEARCH_CLASS, 'getProductDetailsFromParts', {
				ids,
				searchTerm: code,
				pageNumber: safePage,
				pageSize
			})
		);
		if (details.status >= 400 || !details.data) {
			return {
				meta: {
					status: details.status >= 400 ? details.status : 502,
					currentItemsDisplayed: 0,
					page: 0
				},
				products: []
			};
		}
		const products = (details.data.returnValue?.items ?? []).map((row) =>
			toProduct(row, productsById)
		);
		const totalRecords = details.data.returnValue?.totalRecords ?? 0;
		const elapsed = detailsStarted === undefined ? undefined : Date.now() - detailsStarted;
		const productsData: ProductsData = {
			meta: {
				status: details.status,
				currentItemsDisplayed: products.length,
				totalItems: details.data.returnValue?.totalRecords,
				page: safePage,
				pages: Math.ceil(totalRecords / pageSize),
				maxItemsPagination: pageSize,
				performanceTimings: elapsed === undefined ? undefined : { proxyToSource: elapsed }
			},
			products
		};
		if (productsData.meta.status < 400) await addSpecifications(productsById);
		return productsData;
	} catch (error) {
		console.error('Fleetguard error', error);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
