import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import type { SfImage, SfRow } from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const CATALOG_ORIGIN = 'https://www.sf-filter.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/api/cross-reference/product-search`;
// The search stops at 50 rows. Asking for a larger limit still returns 50.
const PAGE_CAP = 50;
const DETAIL_CONCURRENCY = 6;
const HEIGHT = 'Height (mm)';
const OUTER = 'Outer Diameter / Length (mm)';
const INNER = 'Inner Diameter / Width (mm)';
// Spin-on filters store the thread in Inner Diameter / Width, for example "3/4 -16 UNF".
const THREAD = /\b(?:UNF|UNC|UNEF|UNS|NPTF?|BSPP|BSPT|BSP|PG)\b|\bM\s?\d|\d\s*\/\s*\d+\s*-\s*\d+/i;
const MILLIMETERS = /^(\d+(?:[.,]\d+)?)(?:\s*mm)?$/i;

const catalogHeaders = {
	...headers,
	Accept: 'application/json',
	'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
	'x-culture': 'en'
};

interface SpecProperty {
	name: string;
	value: string;
}

function text(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function millimeters(value: string): number | undefined {
	const match = MILLIMETERS.exec(value.trim());
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function thumbnails(image: SfImage | undefined): string[] | undefined {
	if (!image) return undefined;
	const urls: string[] = [];
	for (const candidate of [image.defaultUrl, image.defaultUrlHiRes]) {
		const url = catalogHttpsUrl(candidate);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function toProduct(row: SfRow): Product {
	const product: Product = {
		manufacturer: row.brand,
		manufacturer_code: row.originalNumber,
		source_reference_code: row.item.link.title
	};
	const detailsUrl = catalogHttpsUrl(row.item.link.url, `${CATALOG_ORIGIN}/`);
	if (detailsUrl) product.detailsUrl = detailsUrl;
	const category = text(row.type);
	if (category) product.category = category;
	const images = thumbnails(row.item.image);
	if (images) product.thumbnails = images;
	return product;
}

function graphNodes(data: unknown): unknown[] {
	if (Array.isArray(data)) return data.flatMap((node) => graphNodes(node));
	if (!data || typeof data !== 'object') return [];
	const graph = (data as { '@graph'?: unknown })['@graph'];
	return Array.isArray(graph) ? graph : [data];
}

function specProperties(html: string): SpecProperty[] {
	// A shared /g regex keeps lastIndex, and details run concurrently.
	const ldJson = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	for (const match of html.matchAll(ldJson)) {
		let data: unknown;
		try {
			data = JSON.parse(match[1]);
		} catch {
			continue;
		}
		for (const node of graphNodes(data)) {
			if (!node || typeof node !== 'object') continue;
			const record = node as { '@type'?: unknown; additionalProperty?: unknown };
			const type = record['@type'];
			const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
			if (!isProduct || !Array.isArray(record.additionalProperty)) continue;
			const properties: SpecProperty[] = [];
			for (const property of record.additionalProperty) {
				if (!property || typeof property !== 'object') continue;
				const name = text((property as { name?: unknown }).name);
				const value = text((property as { value?: unknown }).value);
				if (name && value) properties.push({ name, value });
			}
			return properties;
		}
	}
	return [];
}

// "111/97" and "153/0" name two sizes. A single number is the labeled diameter or height.
// Height "0" is the catalog's empty value.
function readDimension(property: SpecProperty): Product['dimensions'] | undefined {
	if (property.name === HEIGHT) {
		const height = millimeters(property.value);
		return height === undefined ? undefined : { height };
	}
	if (property.name === OUTER) {
		const externalDiameter = millimeters(property.value);
		return externalDiameter === undefined ? undefined : { externalDiameter };
	}
	if (property.name !== INNER) return undefined;
	if (THREAD.test(property.value)) return { threadSize: property.value };
	const internalDiameter = millimeters(property.value);
	return internalDiameter === undefined ? undefined : { internalDiameter };
}

function applyDimensions(product: Product, properties: readonly SpecProperty[]): void {
	const dimensions: NonNullable<Product['dimensions']> = {};
	for (const property of properties) Object.assign(dimensions, readDimension(property));
	if (Object.keys(dimensions).length > 0) product.dimensions = dimensions;
}

async function addDetails(detailsByUrl: Map<string, Product[]>): Promise<void> {
	if (detailsByUrl.size === 0) return;
	const pending = detailsByUrl[Symbol.iterator]();

	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [url, products] = next.value;
			try {
				const response = await axios.request<string>({
					method: 'GET',
					url,
					headers: {
						...headers,
						Accept: 'text/html',
						'Accept-Language': 'en,en-US;q=0.7,it;q=0.3'
					},
					responseType: 'text'
				});
				if (response.status >= 400 || typeof response.data !== 'string') continue;
				const properties = specProperties(response.data);
				if (properties.length === 0) continue;
				for (const product of products) applyDimensions(product, properties);
			} catch (error) {
				console.error('sf details', url, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, detailsByUrl.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

// pagination.pagesCount is not ceil(itemsTotal / pageSize). "oil" at limit 5 reports 10 pages for 12 items.
function pageCount(total: number, size: number): number {
	return total <= 0 || size <= 0 ? 0 : Math.ceil(total / size);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const offset = pageSize * (safePage - 1);
	const detailsByUrl = new Map<string, Product[]>();

	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'sf',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: { limit: pageSize, offset, query: code },
				headers: catalogHeaders
			},
			{
				rowsIterator: (responseData) => {
					const products: Product[] = [];
					for (const row of responseData.payload.data) {
						const product = toProduct(row);
						products.push(product);
						if (!product.detailsUrl) continue;
						const group = detailsByUrl.get(product.detailsUrl);
						if (group) group.push(product);
						else detailsByUrl.set(product.detailsUrl, [product]);
					}
					return products;
				},
				nPages: (responseData) => {
					const pagination = responseData.payload.pagination;
					const size = pagination.pageSize > 0 ? pagination.pageSize : pageSize;
					return pageCount(pagination.itemsTotal, size);
				},
				pagination: (responseData) => {
					const reported = responseData.payload.pagination.pageSize;
					return reported > 0 ? reported : pageSize;
				},
				totalItems: (responseData) => responseData.payload.pagination.itemsTotal
			},
			config,
			safePage
		);
		if (productsData.meta.status < 400) await addDetails(detailsByUrl);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'SF error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
