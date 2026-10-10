import type { GetNextProducts, GetProducts } from '../types';
import type FleetguardPartsResponse from './Response1Schema';
import type { FleetguardPartsPayload } from './Response1Schema';
import type FleetguardSchema from './ResponseSchema';
import type { FleetguardItem, FleetguardSpec, FleetguardSpecResponse } from './ResponseSchema';
import axios from '#lib/product_sources/axios.server.js';
import { headers } from '#lib/product_sources/constants.js';
import { getJsonToProducts } from '#lib/product_sources/getJsonToProductsData.server.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';

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

function apexCall(classname: string, method: string, parameters: object) {
	return {
		method: 'POST' as const,
		url: APEX_URL,
		headers: {
			...catalogHeaders,
			'Content-Type': 'application/json; charset=utf-8'
		},
		data: {
			namespace: '',
			classname,
			method,
			isContinuation: false,
			params: parameters,
			cacheable: false
		}
	};
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
				const response = await axios.request<FleetguardSpecResponse>(
					apexCall(SPEC_CLASS, 'retrieveProductSpecifications', {
						productId: id,
						language: 'en-US'
					})
				);
				if (response.status >= 400) continue;
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
		const listed = await axios.request<FleetguardPartsResponse>(
			apexCall(SEARCH_CLASS, 'fetchProductsFromParts', { searchTerm: code })
		);
		if (listed.status >= 400) {
			return {
				meta: {
					status: listed.status,
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

		const productsData = await getJsonToProducts<FleetguardSchema>(
			'fleetguard',
			apexCall(SEARCH_CLASS, 'getProductDetailsFromParts', {
				ids,
				searchTerm: code,
				pageNumber: safePage,
				pageSize
			}),
			{
				rowsIterator: (responseData) =>
					(responseData.returnValue?.items ?? []).map((row) => toProduct(row, productsById)),
				nPages: (responseData) =>
					Math.ceil((responseData.returnValue?.totalRecords ?? 0) / pageSize),
				pagination: pageSize,
				totalItems: (responseData) => responseData.returnValue?.totalRecords
			},
			config,
			safePage
		);
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
