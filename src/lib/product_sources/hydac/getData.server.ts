import { parseHTML } from 'linkedom';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { headers } from '#lib/product_sources/constants.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';
import axios from '#lib/product_sources/axios.server.js';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import type { HydacRelation } from './ResponseSchema';

const SEARCH_URL = 'https://www.hydac.com/en/e-tools/betterfit/betterfitSearch/';
const CATALOG_BASE = 'https://www.hydac.com/';
const DETAIL_CONCURRENCY = 4;

// Shop attribute row classes. English labels are the fallback when the class is absent.
const SPEC_BY_CLASS: Record<string, 'category' | 'mediaType' | 'efficiency'> = {
	M20003513: 'category',
	M20000228: 'mediaType',
	M20000123: 'efficiency'
};
const SPEC_BY_LABEL: Record<string, 'category' | 'mediaType' | 'efficiency'> = {
	'Element type': 'category',
	'Filter material, element': 'mediaType',
	'Filtration rating': 'efficiency'
};

const searchHeaders = {
	...headers,
	Accept: '*/*',
	'Accept-Language': 'en-US,en;q=0.5',
	'Cache-Control': 'no-cache',
	Connection: 'keep-alive',
	Host: 'www.hydac.com',
	Pragma: 'no-cache',
	Priority: 'u=0',
	Referer: 'https://www.hydac.com/en/e-tools/betterfit/',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'cors',
	'Sec-Fetch-Site': 'same-origin',
	'Sec-GPC': '1',
	TE: 'trailers'
};

function cleanText(value: string | null | undefined): string | undefined {
	const text = value?.replaceAll(/\s+/gu, ' ').trim();
	return text || undefined;
}

// Absolute /shop/ links are product pages. Relative item/... paths 404.
function shopDetailsUrl(link: string | undefined): string | undefined {
	const url = catalogHttpsUrl(link, CATALOG_BASE);
	if (!url) return undefined;
	return new URL(url).pathname.startsWith('/shop/') ? url : undefined;
}

function thumbnailsOf(row: HydacRelation): string[] | undefined {
	const urls: string[] = [];
	const hydacImage = catalogHttpsUrl(row.hydac.image?.src, CATALOG_BASE);
	if (hydacImage) urls.push(hydacImage);
	const competitorImages = row.competitor.image ?? [];
	for (const image of competitorImages) {
		const url = catalogHttpsUrl(image, CATALOG_BASE);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function productFromRow(row: HydacRelation): Product | undefined {
	const manufacturer = cleanText(row.competitor?.manufacturer?.title);
	const manufacturerCode = cleanText(row.competitor?.title);
	const sourceReferenceCode = cleanText(row.hydac?.title);
	if (!manufacturer || !manufacturerCode || !sourceReferenceCode) return undefined;

	const product: Product = {
		manufacturer,
		manufacturer_code: manufacturerCode,
		source_reference_code: sourceReferenceCode
	};
	const detailsUrl = shopDetailsUrl(row.hydac.image?.link);
	if (detailsUrl) product.detailsUrl = detailsUrl;
	const thumbnails = thumbnailsOf(row);
	if (thumbnails) product.thumbnails = thumbnails;
	const description = cleanText(row.hydac.image?.description);
	if (description && description !== manufacturerCode && description !== sourceReferenceCode) {
		product.description = description;
	}
	return product;
}

interface ShopSpecs {
	category?: string;
	mediaType?: string;
	efficiency?: string;
}

function specKey(row: Element): 'category' | 'mediaType' | 'efficiency' | undefined {
	for (const name of row.classList) {
		const fromClass = SPEC_BY_CLASS[name];
		if (fromClass) return fromClass;
	}
	const label = cleanText(row.querySelector('th')?.textContent);
	return label ? SPEC_BY_LABEL[label] : undefined;
}

function specsFromDocument(document: Document): ShopSpecs {
	const specs: ShopSpecs = {};
	const rows = document.querySelectorAll('#product-attribute-specs-table tbody tr');
	for (const row of rows) {
		const value = cleanText(row.querySelector('td')?.textContent);
		const key = specKey(row);
		if (value && key) specs[key] = value;
	}
	return specs;
}

function applyShopSpecs(product: Product, specs: ShopSpecs): void {
	if (specs.category) product.category = specs.category;
	if (!specs.mediaType && !specs.efficiency) return;
	const next: NonNullable<Product['specs']> = {};
	if (specs.mediaType) next.mediaType = specs.mediaType;
	if (specs.efficiency) next.efficiency = specs.efficiency;
	product.specs = next;
}

async function shopSpecs(url: string): Promise<ShopSpecs | undefined> {
	const response = await axios.request<string>({
		method: 'GET',
		url,
		responseType: 'text',
		headers: {
			...headers,
			Accept: 'text/html,application/xhtml+xml',
			'Accept-Language': 'en-US,en;q=0.5',
			Referer: 'https://www.hydac.com/en/e-tools/betterfit/'
		}
	});
	if (response.status >= 400 || typeof response.data !== 'string') return undefined;
	return response.data.includes('product-attribute-specs-table')
		? specsFromDocument(parseHTML(response.data).document)
		: undefined;
}

async function addShopSpecs(detailsByProduct: Map<Product, string>): Promise<void> {
	const productsByUrl = new Map<string, Product[]>();
	for (const [product, url] of detailsByProduct) {
		const products = productsByUrl.get(url) ?? [];
		products.push(product);
		productsByUrl.set(url, products);
	}
	if (productsByUrl.size === 0) return;

	const pending = productsByUrl.entries();
	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [url, products] = next.value;
			try {
				const specs = await shopSpecs(url);
				if (!specs) continue;
				for (const product of products) applyShopSpecs(product, specs);
			} catch (error) {
				console.error('hydac shop details', url, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsByUrl.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const limit = Math.max(maxItems, 0);
	const detailsByProduct = new Map<Product, string>();

	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'hydac',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: { query: code },
				headers: searchHeaders
			},
			{
				rowsIterator: (responseData) => {
					const rows = Array.isArray(responseData.relation) ? responseData.relation : [];
					const products: Product[] = [];
					for (const row of rows.slice(0, limit)) {
						const product = productFromRow(row);
						if (!product) continue;
						products.push(product);
						if (product.detailsUrl) detailsByProduct.set(product, product.detailsUrl);
					}
					return products;
				},
				// One response. The tool lists at most 5 rows and resultCount matches that list.
				totalItems: (responseData) =>
					typeof responseData.resultCount === 'number' ? responseData.resultCount : undefined,
				nPages: () => 1
			},
			config
		);
		await addShopSpecs(detailsByProduct);
		return productsData;
	} catch (error) {
		console.error('Hydac error', error);
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

// Betterfit has no page parameter. A second call repeats the same rows.
export const getNextProducts: GetNextProducts = () => undefined;
