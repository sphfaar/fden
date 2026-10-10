import type { AxiosResponse } from 'axios';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import type { DonaldsonAttributeBody, DonaldsonAttributeResponse } from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { CookieJar } from 'tough-cookie';

const CATALOG_ORIGIN = 'https://shop.donaldson.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/store/en-it/search`;
const ATTR_URL = `${CATALOG_ORIGIN}/store/rest/fetchProductAttrAndRecentlyViewed`;
// A GET of /store/en-it/ is 404 and still opens the guest session whose attribute names are English.
const SESSION_URL = `${CATALOG_ORIGIN}/store/en-it/`;
// Public token from the shop bundle. The attribute route answers 401 without it.
const SERVICE_TOKEN = '3TuSgTm3MyS9ZL0adPDjYg==';
const PAGE_CAP = 20;
const ATTR_CONCURRENCY = 6;
const MILLIMETERS = /^(\d+(?:[.,]\d+)?)\s*mm\b/i;
const METERS = /^(\d+(?:[.,]\d+)?)\s*m\b/i;

const searchHeaders = {
	...headers,
	Accept: 'application/json',
	'Accept-Language': 'en-US,en;q=0.5',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'no-cors',
	'Sec-Fetch-Site': 'same-site',
	Priority: 'u=0',
	Pragma: 'no-cache',
	'Cache-Control': 'no-cache',
	TE: 'trailers'
};

interface DetailKey {
	id: string;
	fpp: string;
}

function attributeText(value: unknown): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}

function textRecord(record: Readonly<Record<string, unknown>> | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	if (!record) return out;
	for (const [key, value] of Object.entries(record)) {
		const text = attributeText(value);
		if (text) out[key] = text;
	}
	return out;
}

function firstText(record: Record<string, string>, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (value) return value;
	}
	return undefined;
}

// Element sizes are millimeters. Packaged sizes are meters ("0.089 m"); store those as millimeters too.
function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const mm = MILLIMETERS.exec(value);
	const meters = mm ? undefined : METERS.exec(value);
	const match = mm ?? meters;
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	if (parsed === 0 || !Number.isFinite(parsed)) return undefined;
	return mm ? parsed : Math.round(parsed * 1_000_000) / 1000;
}

function firstMm(record: Record<string, string>, keys: readonly string[]): number | undefined {
	for (const key of keys) {
		const parsed = millimeters(record[key]);
		if (parsed !== undefined) return parsed;
	}
	return undefined;
}

function efficiencyText(record: Record<string, string>): string | undefined {
	const parts: string[] = [];
	for (const [label, value] of Object.entries(record)) {
		if (!/^(?:efficiency|efficienza)\b/i.test(label) || /\btest\b/i.test(label)) continue;
		const leading = /^(\d+(?:[.,]\d+)?)/.exec(value);
		if (leading && Number(leading[1].replace(',', '.')) === 0) continue;
		parts.push(`${label}: ${value}`);
	}
	return parts.length > 0 ? parts.join('; ') : undefined;
}

function applyAttributes(product: Product, body: DonaldsonAttributeBody | undefined): void {
	if (!body) return;
	const attributes = textRecord(body.dynamicAttributes);
	const externalDiameter = firstMm(attributes, ['Outer Diameter', 'Diametro esterno']);
	const internalDiameter = firstMm(attributes, [
		'Inner Diameter',
		'Inside Diameter',
		'Diametro interno'
	]);
	// The catalog's axial size is Height or Length. Product stores that number as height.
	const height = firstMm(attributes, [
		'Height',
		'Altezza',
		'Overall Height',
		'Length',
		'Lunghezza',
		'Overall Length',
		'Body Length'
	]);
	const threadSize = firstText(attributes, ['Thread Size', 'Dimensione filettatura']);
	const gasketExternalDiameter = firstMm(attributes, ['Gasket OD', 'DO guarnizione']);
	const gasketInternalDiameter = firstMm(attributes, ['Gasket ID', 'DI guarnizione']);
	if (
		externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		height !== undefined ||
		threadSize ||
		gasketExternalDiameter !== undefined ||
		gasketInternalDiameter !== undefined
	) {
		product.dimensions = {};
		if (externalDiameter !== undefined) product.dimensions.externalDiameter = externalDiameter;
		if (internalDiameter !== undefined) product.dimensions.internalDiameter = internalDiameter;
		if (height !== undefined) product.dimensions.height = height;
		if (threadSize) product.dimensions.threadSize = threadSize;
		if (gasketExternalDiameter !== undefined) {
			product.dimensions.gasketExternalDiameter = gasketExternalDiameter;
		}
		if (gasketInternalDiameter !== undefined) {
			product.dimensions.gasketInternalDiameter = gasketInternalDiameter;
		}
	}

	const mediaType = firstText(attributes, ['Media Type', 'Tipo mezzo filtrante']);
	const efficiency = efficiencyText(attributes);
	const flowDirection = firstText(attributes, ['Flow Direction']);
	if (mediaType || efficiency || flowDirection) {
		product.specs = {};
		if (mediaType) product.specs.mediaType = mediaType;
		if (efficiency) product.specs.efficiency = efficiency;
		if (flowDirection) product.specs.flowDirection = flowDirection;
	}

	const packaged = textRecord(body.packageDimensions);
	const length = firstMm(packaged, ['Packaged Length', 'Lunghezza con imballaggio']);
	const width = firstMm(packaged, ['Packaged Width', 'Larghezza con imballaggio']);
	const packageHeight = firstMm(packaged, ['Packaged Height', 'Altezza con imballaggio']);
	if (length !== undefined && width !== undefined && packageHeight !== undefined) {
		product.packaging = { width, length, height: packageHeight };
	}
}

function rememberCookies(jar: CookieJar, url: string, setCookie: unknown): void {
	const cookies = Array.isArray(setCookie)
		? setCookie
		: typeof setCookie === 'string'
			? [setCookie]
			: [];
	for (const cookie of cookies) {
		if (typeof cookie !== 'string' || cookie.length === 0) continue;
		try {
			jar.setCookieSync(cookie, url);
		} catch {
			// Skip a malformed cookie and keep the rest of the session.
		}
	}
}

function cookieHeader(jar: CookieJar, url: string): string | undefined {
	const value = jar.getCookieStringSync(url);
	return value.length > 0 ? value : undefined;
}

async function openAttributeSession(): Promise<string | undefined> {
	const jar = new CookieJar();
	const response = await axios.get(SESSION_URL, {
		headers: {
			...headers,
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'none',
			'Upgrade-Insecure-Requests': '1'
		},
		validateStatus: () => true
	});
	rememberCookies(jar, SESSION_URL, response.headers['set-cookie']);
	return cookieHeader(jar, ATTR_URL);
}

async function fetchAttributes(
	key: DetailKey,
	cookie: string
): Promise<DonaldsonAttributeBody | undefined> {
	const response: AxiosResponse<DonaldsonAttributeResponse> = await axios.get(ATTR_URL, {
		params: {
			id: key.id,
			fpp: key.fpp,
			globalSearchFlag: 'false'
		},
		headers: {
			...searchHeaders,
			service_token: SERVICE_TOKEN,
			Cookie: cookie
		},
		validateStatus: () => true
	});
	return response.status >= 400 ? undefined : response.data?.productAttributesResponse;
}

async function addAttributes(detailByProduct: Map<Product, DetailKey>): Promise<void> {
	if (detailByProduct.size === 0) return;
	let cookie: string | undefined;
	try {
		cookie = await openAttributeSession();
	} catch (error) {
		console.error('donaldson attributes session', error);
		return;
	}
	if (!cookie) return;

	const groups = new Map<string, { key: DetailKey; products: Product[] }>();
	for (const [product, key] of detailByProduct) {
		const groupId = `${key.id}\n${key.fpp}`;
		const group = groups.get(groupId);
		if (group) group.products.push(product);
		else groups.set(groupId, { key, products: [product] });
	}
	const pending = groups.values().toArray();
	let index = 0;

	async function worker(): Promise<void> {
		while (index < pending.length) {
			const current = index;
			index += 1;
			const group = pending[current];
			if (!group) return;
			try {
				const body = await fetchAttributes(group.key, cookie as string);
				if (!body) continue;
				for (const product of group.products) applyAttributes(product, body);
			} catch (error) {
				console.error('donaldson attributes', group.key.id, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(ATTR_CONCURRENCY, pending.length) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const nItems = Math.min(maxItems, PAGE_CAP);

	const formattedCodeRgx = /[^a-zA-Z0-9]/gi;
	const formattedCode = code.replaceAll(formattedCodeRgx, '');
	const detailByProduct = new Map<Product, DetailKey>();
	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'donaldson',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: {
					No: `${nItems * (page - 1)}`,
					Ntt: `${formattedCode}*`,
					Ntk: 'All',
					originalSearchTerm: `${code}*`,
					st: 'coparts'
				},
				headers: searchHeaders
			},
			{
				rowsIterator: (responseData) => {
					const products: Product[] = [];
					const rows = responseData.contents?.[0]?.MainContent?.[0]?.competitorProductDetailDTOList;
					if (!rows) return products;
					for (const row of rows) {
						const thumbnail = catalogHttpsUrl(row.thumbnailImage, `${CATALOG_ORIGIN}/`);
						const product: Product = {
							manufacturer: row.manufactureName,
							manufacturer_code: row.manufacturerPartNumber,
							source_reference_code: row.donaldsonPartNumber,
							detailsUrl: catalogHttpsUrl(row.pdpURL, `${CATALOG_ORIGIN}/`),
							thumbnails: thumbnail ? [thumbnail] : undefined,
							description: row.description,
							category: row.productLine
						};
						const id = row.productId?.trim();
						const fpp = row.donaldsonPartNumber?.trim();
						if (id && fpp) detailByProduct.set(product, { id, fpp });
						products.push(product);
					}
					return products;
				},
				nPages: (responseData) =>
					Math.ceil(
						(responseData.contents[0].MainContent[0].competitorPartsCount ?? NaN) /
							(responseData.contents[0].MainContent[0].customerPartsPerPage ?? NaN)
					),
				pagination: (responseData) => responseData.contents[0].MainContent[0].customerPartsPerPage,
				totalItems: (responseData) => Number(responseData.contents[0].MainContent[0].competitorPartsCount)
			},
			config,
			page
		);
		if (productsData.meta.status < 400) await addAttributes(detailByProduct);
		return productsData;
	} catch (error) {
		console.error('Donaldson error', error);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				maxItemsPagination: 0,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page) =>
	await getProducts(code, maxItems, config, page + 1);
