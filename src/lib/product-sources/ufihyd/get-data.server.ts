import type { GetNextProducts, GetProducts } from '../types';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getHtmlToProducts } from '../get-html-to-products-data.server';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { parseHTML } from 'linkedom';

const SEARCH_URL = 'https://crossreference.ufihyd.com/';
// WordPress `posts_per_page` for this search. The template does not print a total or a pager.
const CATALOG_PAGE_SIZE = 10;
const DETAIL_CONCURRENCY = 4;
const PLACEHOLDER_IMAGE = /\/not-available\./i;
const MILLIMETERS = /^(\d+(?:[.,]\d+)?)\s*\(mm\)$/i;
const BOX_MILLIMETERS =
	/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*\(mm\)$/i;

const catalogHeaders = {
	...headers,
	'Sec-GPC': '1'
};

function cellText(row: Element, selector: string): string {
	return row.querySelector(selector)?.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';
}

function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = MILLIMETERS.exec(value.trim());
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : undefined;
}

// Spin-on elements print the port in the Internal diameter row, for example `1''12 UNF`.
function threadSize(value: string | undefined): string | undefined {
	if (!value || millimeters(value) !== undefined) return undefined;
	return /\d/.test(value) && /[A-Za-z'"]/.test(value) ? value : undefined;
}

function packaging(value: string | undefined): Product['packaging'] | undefined {
	if (!value) return undefined;
	const match = BOX_MILLIMETERS.exec(value.trim());
	if (!match) return undefined;
	const [width, length, height] = match.slice(1, 4).map((part) => Number(part.replace(',', '.')));
	return width === undefined ||
		length === undefined ||
		height === undefined ||
		!Number.isFinite(width) ||
		!Number.isFinite(length) ||
		!Number.isFinite(height)
		? undefined
		: { width, length, height };
}

function infoPairs(document: Document): Map<string, string> {
	const pairs = new Map<string, string>();
	for (const term of document.querySelectorAll('#tab-info dt')) {
		const description = term.nextElementSibling;
		if (!description || description.tagName !== 'DD') continue;
		const label = term.textContent?.replaceAll(/\s+/g, ' ').trim();
		const value = description.textContent?.replaceAll(/\s+/g, ' ').trim();
		if (label && value) pairs.set(label, value);
	}
	return pairs;
}

function dimensionsFrom(pairs: Map<string, string>): Product['dimensions'] | undefined {
	const dimensions: NonNullable<Product['dimensions']> = {};
	const externalDiameter = millimeters(pairs.get('External diameter'));
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	const internal = pairs.get('Internal diameter');
	const internalDiameter = millimeters(internal);
	if (internalDiameter === undefined) {
		const thread = threadSize(internal);
		if (thread) dimensions.threadSize = thread;
	} else {
		dimensions.internalDiameter = internalDiameter;
	}
	const height = millimeters(pairs.get('Height'));
	if (height !== undefined) dimensions.height = height;
	return dimensions.externalDiameter !== undefined ||
		dimensions.internalDiameter !== undefined ||
		dimensions.height !== undefined ||
		dimensions.threadSize
		? dimensions
		: undefined;
}

function specsFrom(pairs: Map<string, string>): Product['specs'] | undefined {
	const specs: NonNullable<Product['specs']> = {};
	const mediaType = pairs.get('Filter media');
	if (mediaType) specs.mediaType = mediaType;
	const efficiency = pairs.get('Filtration grade');
	if (efficiency) specs.efficiency = efficiency;
	return specs.mediaType || specs.efficiency ? specs : undefined;
}

function thumbnails(document: Document): string[] | undefined {
	const urls: string[] = [];
	for (const image of document.querySelectorAll('#tab-info .gallery img')) {
		const source = image.getAttribute('src');
		if (!source || PLACEHOLDER_IMAGE.test(source)) continue;
		const url = catalogHttpsUrl(source, SEARCH_URL);
		if (url) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function applyDetails(product: Product, document: Document): void {
	const pairs = infoPairs(document);
	const dimensions = dimensionsFrom(pairs);
	if (dimensions) product.dimensions = dimensions;
	const specs = specsFrom(pairs);
	if (specs) product.specs = specs;
	const box = packaging(pairs.get('Box (width x length x height)'));
	if (box) product.packaging = box;
	const images = thumbnails(document);
	if (images) product.thumbnails = images;
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
				console.error('ufihyd product page', url, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsByUrl.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

// A full page has no printed total. HEAD `paged + 1`: 404 is the last page, anything else may continue.
async function hasAnotherPage(code: string, page: number): Promise<boolean> {
	try {
		const response = await axios.request({
			method: 'HEAD',
			url: SEARCH_URL,
			params: { s: code, paged: page + 1 },
			headers: catalogHeaders
		});
		return response.status < 400;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404) return false;
		console.error('ufihyd next page', code, page + 1, error);
		return true;
	}
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const safePage = page > 0 ? page : 1;
	const limit = Math.max(1, maxItems);
	let catalogCount = 0;
	const pageByProduct = new Map<Product, string>();

	try {
		const productsData = await getHtmlToProducts(
			'ufihyd',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: { s: code, paged: safePage },
				headers: catalogHeaders
			},
			{
				tableRows: (document) => document.querySelectorAll('.codice'),
				rowsIterator: (tableRows) => {
					catalogCount = tableRows.length;
					const products: Product[] = [];
					for (let index = 0; index < Math.min(tableRows.length, limit); index++) {
						const row = tableRows[index];
						const detailsUrl = catalogHttpsUrl(
							row.querySelector(':scope .ufi-code a')?.getAttribute('href'),
							SEARCH_URL
						);
						const product: Product = {
							manufacturer: cellText(row, ':scope > td[data-title="Manufacturer"] span'),
							manufacturer_code: cellText(row, ':scope > .manufacturer-code span'),
							source_reference_code: cellText(row, ':scope > .ufi-code a span')
						};
						if (detailsUrl) {
							product.detailsUrl = detailsUrl;
							pageByProduct.set(product, detailsUrl);
						}
						products.push(product);
					}
					return products;
				}
			},
			config,
			safePage,
			Math.min(limit, CATALOG_PAGE_SIZE)
		);

		if (productsData.meta.status >= 400) return productsData;

		const detailStarted = config?.showPerfReqProxyToSource ? Date.now() : undefined;
		const more = catalogCount >= CATALOG_PAGE_SIZE && (await hasAnotherPage(code, safePage));
		if (more) {
			productsData.meta.totalItems = `${safePage * CATALOG_PAGE_SIZE}+`;
		} else {
			productsData.meta.pages = safePage;
			productsData.meta.totalItems = (safePage - 1) * CATALOG_PAGE_SIZE + catalogCount;
		}
		await addDetails(pageByProduct);
		if (detailStarted !== undefined) {
			const timings = productsData.meta.performanceTimings ?? {};
			timings.proxyToSource = (timings.proxyToSource ?? 0) + (Date.now() - detailStarted);
			productsData.meta.performanceTimings = timings;
		}
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'UFI hyd. error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
