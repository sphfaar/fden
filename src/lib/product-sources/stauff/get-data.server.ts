import type { GetNextProducts, GetProducts } from '../types';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getHtmlToProducts } from '../get-html-to-products-data.server';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { parseHTML } from 'linkedom';

const CATALOG_ORIGIN = 'https://www.filterinterchange.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/en/filter-interchange/results.html`;
// The listen action always returns 10 rows. `offset` is an item index, not a page of `maxItems`.
const CATALOG_PAGE_SIZE = 10;
const DETAIL_CONCURRENCY = 4;
const CELLS_PER_PRODUCT = 5;
// UI chrome and the "no photo" placeholder are not product images.
const NOT_PRODUCT_IMAGE =
	/platzhalter|replacement\.jpg|magicon|merken\.png|details\.png|\/sample-\d+/iu;
const MILLIMETERS = /^(\d+(?:[.,]\d+)?)\s*mm\b/iu;
const CELL_MILLIMETERS: Record<string, 'externalDiameter' | 'internalDiameter' | 'height'> = {
	ED: 'externalDiameter',
	ID: 'internalDiameter',
	H: 'height'
};

const catalogHeaders = {
	...headers,
	Accept:
		'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.5',
	'Sec-GPC': '1',
	Connection: 'keep-alive',
	'Upgrade-Insecure-Requests': '1',
	'Sec-Fetch-Dest': 'document',
	'Sec-Fetch-Mode': 'navigate',
	'Sec-Fetch-Site': 'none',
	'Sec-Fetch-User': '?1',
	Priority: 'u=0, i',
	Pragma: 'no-cache',
	'Cache-Control': 'no-cache'
};

function clean(value: string | null | undefined): string {
	return value?.replaceAll(/\s+/gu, ' ').trim() ?? '';
}

function resultCount(document: Document): number {
	const parsed = Number(document.querySelector('.numresults')?.textContent?.trim());
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

// `0,0 mm / 0.00 in` is the empty diameter. Spin-on elements print it when there is no bore.
function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = MILLIMETERS.exec(value.trim());
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function dimensionsFromCell(text: string): Product['dimensions'] | undefined {
	const dimensions: NonNullable<Product['dimensions']> = {};
	for (const [label, field] of Object.entries(CELL_MILLIMETERS)) {
		const match = new RegExp(String.raw`${label}:\s*(\d+(?:[.,]\d+)?)\s*mm`, 'iu').exec(text);
		if (!match) continue;
		const parsed = Number(match[1].replace(',', '.'));
		if (!Number.isFinite(parsed) || parsed <= 0) continue;
		dimensions[field] = parsed;
	}
	return dimensions.externalDiameter !== undefined ||
		dimensions.internalDiameter !== undefined ||
		dimensions.height !== undefined
		? dimensions
		: undefined;
}

function dimensionsFromPairs(pairs: Map<string, string>): Product['dimensions'] | undefined {
	const dimensions: NonNullable<Product['dimensions']> = {};
	const externalDiameter = millimeters(pairs.get('External diameter'));
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	const internalDiameter = millimeters(pairs.get('Internal diameter'));
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	const height = millimeters(pairs.get('Height'));
	if (height !== undefined) dimensions.height = height;
	return dimensions.externalDiameter !== undefined ||
		dimensions.internalDiameter !== undefined ||
		dimensions.height !== undefined
		? dimensions
		: undefined;
}

function specsFrom(pairs: Map<string, string>): Product['specs'] | undefined {
	const specs: NonNullable<Product['specs']> = {};
	const mediaType = pairs.get('Filter material');
	if (mediaType) specs.mediaType = mediaType;
	const micron = pairs.get('Micron rating');
	const beta = pairs.get('β ratio');
	const efficiency = [micron, beta ? `β ratio ${beta}` : undefined].filter(Boolean).join(', ');
	if (efficiency) specs.efficiency = efficiency;
	return specs.mediaType || specs.efficiency ? specs : undefined;
}

function detailPairs(document: Document): Map<string, string> {
	const pairs = new Map<string, string>();
	for (const row of document.querySelectorAll('table.filterdata tr')) {
		const label = clean(row.querySelector('th')?.textContent);
		const value = clean(row.querySelector('td')?.textContent);
		if (label && value) pairs.set(label, value);
	}
	return pairs;
}

function productImage(sources: readonly string[]): string | undefined {
	const urls = sources.filter(
		(source) => !NOT_PRODUCT_IMAGE.test(source) && /\/filterimages(?:-big)?\//iu.test(source)
	);
	const chosen = urls.find((url) => url.includes('/filterimages-big/')) ?? urls[0];
	return chosen ? catalogHttpsUrl(chosen, `${CATALOG_ORIGIN}/`) : undefined;
}

function attributeSources(nodes: NodeListOf<Element> | undefined, name: string): string[] {
	if (!nodes) return [];
	const sources: string[] = [];
	for (const node of nodes) {
		const value = node.getAttribute(name);
		if (value) sources.push(value);
	}
	return sources;
}

function detailsRequestUrl(href: string | undefined): string | undefined {
	if (!href) return undefined;
	let url: URL;
	try {
		url = new URL(href, `${CATALOG_ORIGIN}/`);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'https:' || !url.hostname.endsWith('filterinterchange.com'))
		return undefined;
	if (!url.pathname.endsWith('/details.html')) return undefined;
	for (const key of url.searchParams.keys()) {
		if (key.includes('querylog')) url.searchParams.delete(key);
	}
	return url.href;
}

function applyDetails(product: Product, document: Document): void {
	const pairs = detailPairs(document);
	const dimensions = dimensionsFromPairs(pairs);
	if (dimensions) product.dimensions = { ...dimensions, ...product.dimensions };
	const specs = specsFrom(pairs);
	if (specs) product.specs = specs;
	if (product.thumbnails) return;
	const source = document.querySelector('img.dataimage')?.getAttribute('src');
	const thumbnail = source ? productImage([source]) : undefined;
	if (thumbnail) product.thumbnails = [thumbnail];
}

async function detailDocument(url: string): Promise<Document | undefined> {
	const response = await axios.request<string>({
		method: 'GET',
		url,
		responseType: 'text',
		headers: catalogHeaders
	});
	return response.status >= 400 || typeof response.data !== 'string'
		? undefined
		: parseHTML(response.data).document;
}

async function addDetails(pageByProduct: Map<Product, string>): Promise<void> {
	const productsByUrl = new Map<string, Product[]>();
	for (const [product, url] of pageByProduct) {
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
				const document = await detailDocument(url);
				if (!document) continue;
				for (const product of products) applyDetails(product, document);
			} catch (error) {
				console.error('stauff product page', url, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsByUrl.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const safePage = page > 0 ? page : 1;
	const pageSize = Math.max(1, Math.min(maxItems, CATALOG_PAGE_SIZE));
	const detailByProduct = new Map<Product, string>();

	try {
		const productsData = await getHtmlToProducts(
			'stauff',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: {
					q: code,
					x: '0',
					y: '0',
					'--stauff_filtersuche-results[@package]': 'stauff.filtersuche',
					'--stauff_filtersuche-results[@controller]': 'standard',
					'--stauff_filtersuche-results[@action]': 'listen',
					'--stauff_filtersuche-results[q]': code,
					'--stauff_filtersuche-results[offset]': pageSize * (safePage - 1)
				},
				headers: catalogHeaders,
				responseType: 'text'
			},
			{
				tableRows: (document) => document.querySelectorAll('.filterliste.desktop > tbody > td'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					const count = Math.min(pageSize, Math.floor(tableRows.length / CELLS_PER_PRODUCT));
					for (let index = 0; index < count; index++) {
						const cell = index * CELLS_PER_PRODUCT;
						const original = tableRows[cell + 1]?.textContent ?? '';
						const product: Product = {
							manufacturer: clean(/Manufacturer:\s*(.*)$/imu.exec(original)?.[1]),
							manufacturer_code: clean(original.split('\n', 1)[0]),
							source_reference_code: clean(tableRows[cell + 2]?.textContent)
						};
						const dimensions = dimensionsFromCell(tableRows[cell + 3]?.textContent ?? '');
						if (dimensions) product.dimensions = dimensions;
						const requestUrl = detailsRequestUrl(
							attributeSources(tableRows[cell + 4]?.querySelectorAll('a'), 'href').find((href) =>
								href.includes('detailen')
							)
						);
						const detailsUrl = catalogHttpsUrl(requestUrl);
						if (detailsUrl) product.detailsUrl = detailsUrl;
						if (requestUrl) detailByProduct.set(product, requestUrl);
						const thumbnail = productImage(
							attributeSources(tableRows[cell]?.querySelectorAll('img'), 'src')
						);
						if (thumbnail) product.thumbnails = [thumbnail];
						products.push(product);
					}
					return products;
				},
				nPages: (document) => Math.ceil(resultCount(document) / pageSize),
				totalItems: (document) => resultCount(document)
			},
			config,
			safePage,
			pageSize
		);

		if (productsData.meta.status >= 400) return productsData;

		const detailStarted = config?.showPerfReqProxyToSource ? Date.now() : undefined;
		await addDetails(detailByProduct);
		if (detailStarted !== undefined) {
			const timings = productsData.meta.performanceTimings ?? {};
			timings.proxyToSource = (timings.proxyToSource ?? 0) + (Date.now() - detailStarted);
			productsData.meta.performanceTimings = timings;
		}
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'Stauff error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
