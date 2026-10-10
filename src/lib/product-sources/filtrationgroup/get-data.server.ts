import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import type { FiltrationGroupCategories } from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getHtmlToProducts } from '#lib/product-sources/get-html-to-products-data.server.js';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { parseHTML } from 'linkedom';

const CATALOG_ORIGIN = 'https://shopindustrial.filtrationgroup.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/en/competitor/product/search`;
const GRAPHQL_URL = `${CATALOG_ORIGIN}/graphql`;
const DETAIL_CONCURRENCY = 6;
const ECOPARTS_SHORT = /^With EcoParts, we offer all hydraulic elements/i;
const ECOPARTS_LONG =
	/^When it comes to replacement filter elements for stationary and mobile hydraulic systems/i;
const FLOW_DIRECTION =
	/flow direction\s+((?:from\s+)?(?:the\s+)?(?:inside|outside)\s+to\s+(?:the\s+)?(?:inside|outside))/i;
const ARTICLE_NUMBER = ['Article number', 'Artikelnummer'];
const ARTICLE_NAME = ['Article name', 'Artikelbezeichnung'];
const MANUFACTURER = ['Manufacturer', 'Hersteller'];
const FG_NAME = ['FG name', 'FG-Bezeichnung'];

const catalogHeaders = {
	...headers,
	Accept: 'text/html,application/xhtml+xml',
	'Accept-Language': 'en-US,en;q=0.5'
};

interface ParsedPage {
	sku?: string;
	name?: string;
	thumbnail?: string;
	longDescription?: string;
	dimensions?: Product['dimensions'];
	specs?: Product['specs'];
}

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.replaceAll(/\s+/g, ' ').trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function plain(element: Element | null | undefined): string | undefined {
	return text(element?.textContent);
}

const BLOCK_TAG = /^(?:P|DIV|LI|TR|H[1-6])$/;

// Paragraphs and list items are separate lines. textContent would glue them together.
function blockText(element: Element | null | undefined): string | undefined {
	if (!element) return undefined;
	const parts: string[] = [];
	const walk = (node: Node): void => {
		if (node.nodeType === 3) {
			parts.push(node.textContent ?? '');
			return;
		}
		if (node.nodeType !== 1) return;
		const child = node as Element;
		if (child.tagName === 'BR') {
			parts.push('\n');
			return;
		}
		for (const nested of child.childNodes) walk(nested);
		if (BLOCK_TAG.test(child.tagName)) parts.push('\n');
	};
	for (const child of element.childNodes) walk(child);
	const lines = parts
		.join('')
		.split('\n')
		.map((line) => line.replaceAll(/\s+/g, ' ').trim())
		.filter((line) => line.length > 0);
	return lines.length > 0 ? lines.join('\n') : undefined;
}

function cellText(row: Element, labels: readonly string[]): string {
	const wanted = new Set(labels);
	for (const cell of row.querySelectorAll('[data-th]')) {
		const label = cell.dataset.th;
		if (!label || !wanted.has(label)) continue;
		const value = plain(cell);
		if (value) return value;
	}
	return '';
}

function isSameDesignation(left: string, right: string): boolean {
	return (
		left.replaceAll(/[^a-z0-9]/gi, '').toLowerCase() ===
		right.replaceAll(/[^a-z0-9]/gi, '').toLowerCase()
	);
}

// Article name is the competitor's designation. FG name is this catalog's product name.
function designation(articleName: string, fgName: string): string | undefined {
	return articleName && fgName && !isSameDesignation(articleName, fgName)
		? `${fgName}\n${articleName}`
		: fgName || articleName || undefined;
}

function productUrl(sku: string | undefined): string | undefined {
	return !sku || !/^\d+$/.test(sku)
		? undefined
		: catalogHttpsUrl(`${CATALOG_ORIGIN}/en/${sku}.html`);
}

// English pages print "84.50" or "28,50". A thousands separator such as "1.116" is not a size.
function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const trimmed = value.replaceAll(/\s/g, '');
	let numeric = trimmed;
	if (/^\d+,\d{1,2}$/.test(trimmed)) numeric = trimmed.replace(',', '.');
	else if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return undefined;
	const parsed = Number(numeric);
	return !Number.isFinite(parsed) || parsed <= 0 ? undefined : parsed;
}

// The column is "Filter rating (micrometer)". The cell is the number only.
function efficiency(value: string | undefined): string | undefined {
	const raw = text(value);
	if (!raw) return undefined;
	if (/µm|μm|micrometer|micron/i.test(raw)) return raw;
	return /^\d+(?:[.,]\d+)?$/.test(raw) ? `${raw} µm` : raw;
}

function specificCopy(value: string | undefined, boilerplate: RegExp): string | undefined {
	return !value || boilerplate.test(value) ? undefined : value;
}

function flowDirection(values: Array<string | undefined>): string | undefined {
	for (const value of values) {
		if (!value) continue;
		const match = FLOW_DIRECTION.exec(value);
		if (match) return match[1].replaceAll(/\s+/g, ' ').trim();
	}
	return undefined;
}

function specMap(document: Document): Map<string, string> {
	const specs = new Map<string, string>();
	for (const row of document.querySelectorAll('#product-attribute-specs-table tr')) {
		const label = plain(row.querySelector('th'));
		const value = plain(row.querySelector('td'));
		if (label && value) specs.set(label, value);
	}
	return specs;
}

function parseProductPage(document: Document): ParsedPage {
	const specs = specMap(document);
	const shortDescription = blockText(
		document.querySelector('.product.attribute.short_description .value')
	);
	const longDescription = blockText(document.querySelector('#description .value'));
	const specificShort = specificCopy(shortDescription, ECOPARTS_SHORT);
	const specificLong = specificCopy(longDescription, ECOPARTS_LONG);
	const technical = [specificShort, specificLong].filter(
		(part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index
	);
	const height = millimeters(specs.get('Height (mm)'));
	const externalDiameter = millimeters(specs.get('Outer diameter (mm)'));
	const internalDiameter = millimeters(specs.get('Inner diameter (mm)'));
	const threadSize = text(specs.get('Thread designation'));
	// Seal outer diameter is the gasket OD. Mounting diameter is not the element bore.
	const gasketExternalDiameter = millimeters(specs.get('Seal outer diameter (mm)'));
	const dimensions: Product['dimensions'] = {};
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	if (threadSize) dimensions.threadSize = threadSize;
	if (gasketExternalDiameter !== undefined)
		dimensions.gasketExternalDiameter = gasketExternalDiameter;

	const mediaType = text(specs.get('Filter material'));
	const grade = efficiency(specs.get('Filter rating (micrometer)'));
	const flow = flowDirection([shortDescription, longDescription]);
	const parsedSpecs: Product['specs'] = {};
	if (mediaType) parsedSpecs.mediaType = mediaType;
	if (grade) parsedSpecs.efficiency = grade;
	if (flow) parsedSpecs.flowDirection = flow;

	const photo = catalogHttpsUrl(
		document.querySelector('img.product-image-photo')?.getAttribute('src'),
		`${CATALOG_ORIGIN}/`
	);

	return {
		sku: text(document.querySelector('[itemprop="sku"]')?.textContent),
		name: plain(document.querySelector('h1.page-title .base')),
		thumbnail: photo,
		longDescription: technical.length > 0 ? technical.join('\n\n') : undefined,
		dimensions: Object.keys(dimensions).length > 0 ? dimensions : undefined,
		specs: Object.keys(parsedSpecs).length > 0 ? parsedSpecs : undefined
	};
}

function applyPage(product: Product, page: ParsedPage, skuByProduct: Map<Product, string>): void {
	const sku = page.sku && /^\d+$/.test(page.sku) ? page.sku : skuByProduct.get(product);
	if (sku) {
		skuByProduct.set(product, sku);
		const url = productUrl(sku);
		if (url) product.detailsUrl = url;
	}
	if (!product.description && page.name) product.description = page.name;
	if (page.thumbnail && !product.thumbnails) product.thumbnails = [page.thumbnail];
	if (page.longDescription) product.longDescription = page.longDescription;
	if (page.dimensions) product.dimensions = page.dimensions;
	if (page.specs) product.specs = page.specs;
}

function leafCategory(
	categories: readonly { readonly name?: string | null; readonly url_path?: string | null }[]
): string | undefined {
	let best: { name: string; depth: number } | undefined;
	for (const category of categories) {
		const name = text(category.name);
		if (!name) continue;
		const depth = category.url_path?.split('/').filter(Boolean).length ?? 1;
		if (!best || depth > best.depth) best = { name, depth };
	}
	return best?.name;
}

async function addCategories(skuByProduct: Map<Product, string>): Promise<void> {
	const productsBySku = new Map<string, Product[]>();
	for (const [product, sku] of skuByProduct) {
		const list = productsBySku.get(sku) ?? [];
		list.push(product);
		productsBySku.set(sku, list);
	}
	const skus = productsBySku.keys().toArray();
	if (skus.length === 0) return;
	try {
		const response = await axios.request<FiltrationGroupCategories>({
			method: 'POST',
			url: GRAPHQL_URL,
			headers: {
				...catalogHeaders,
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Store: 'en'
			},
			data: {
				query: `query Categories($skus: [String]) {
					products(filter: { sku: { in: $skus } }) {
						items { sku categories { name url_path } }
					}
				}`,
				variables: { skus }
			}
		});
		if (response.status >= 400) return;
		const items = response.data.data?.products?.items ?? [];
		for (const item of items) {
			const sku = text(item.sku);
			const category = leafCategory(item.categories ?? []);
			if (!sku || !category) continue;
			const products = productsBySku.get(sku) ?? [];
			for (const product of products) product.category = category;
		}
	} catch (error) {
		console.error('filtrationgroup categories', error);
	}
}

async function addDetails(
	productsById: Map<string, Product[]>,
	skuByProduct: Map<Product, string>
): Promise<void> {
	if (productsById.size === 0) return;
	const pending = productsById.entries();

	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [productId, products] = next.value;
			try {
				const response = await axios.request<string>({
					method: 'GET',
					url: `${CATALOG_ORIGIN}/en/catalog/product/view/id/${encodeURIComponent(productId)}`,
					headers: catalogHeaders
				});
				if (response.status >= 400 || typeof response.data !== 'string') continue;
				const { document } = parseHTML(response.data);
				const page = parseProductPage(document);
				for (const product of products) applyPage(product, page, skuByProduct);
			} catch (error) {
				console.error('filtrationgroup product', productId, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsById.size) }, () =>
		worker()
	);
	await Promise.all(workers);
	await addCategories(skuByProduct);
}

export const getProducts: GetProducts = async (code: string, maxItems, config) => {
	const productsById = new Map<string, Product[]>();
	const skuByProduct = new Map<Product, string>();
	const axiosRequestConfig = {
		method: 'GET',
		url: SEARCH_URL,
		params: { search_query: code },
		headers: {
			...headers,
			Accept: 'application/json, text/javascript, */*; q=0.01',
			'Accept-Language': 'en-US,en;q=0.5',
			Referer: `${CATALOG_ORIGIN}/en/comparison-list.html`,
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			TE: 'trailers',
			'X-Requested-With': 'XMLHttpRequest',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		const productsData = await getHtmlToProducts<ResponseSchema>(
			'filtrationgroup',
			axiosRequestConfig,
			{
				tableRows: (document) => document.querySelectorAll('.data.table > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let index = 0; index < tableRows.length && products.length < maxItems; index++) {
						const row = tableRows[index];
						const thumbnail = catalogHttpsUrl(
							row.querySelector('img[src*="/media/catalog/product/"]')?.getAttribute('src'),
							`${CATALOG_ORIGIN}/`
						);
						const fgArticle = plain(row.querySelector('.fg_additional_product_info')) ?? '';
						const fgName = cellText(row, FG_NAME);
						const articleName = cellText(row, ARTICLE_NAME);
						const product: Product = {
							manufacturer: cellText(row, MANUFACTURER),
							manufacturer_code: cellText(row, ARTICLE_NUMBER),
							source_reference_code: fgArticle
						};
						const description = designation(articleName, fgName);
						if (description) product.description = description;
						if (thumbnail) product.thumbnails = [thumbnail];
						const productId = row
							.querySelector('a.competitor_product_info')
							?.dataset.productId?.trim();
						const sku = /^\d+$/.test(fgArticle) ? fgArticle : undefined;
						if (productId) {
							const group = productsById.get(productId) ?? [];
							group.push(product);
							productsById.set(productId, group);
							if (sku) skuByProduct.set(product, sku);
							const url = productUrl(sku);
							if (url) product.detailsUrl = url;
						}
						products.push(product);
					}
					return products;
				},
				documentToHtml: (responseData) => responseData.template
			},
			config
		);
		if (productsData.meta.status < 400) await addDetails(productsById, skuByProduct);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'Filtration Group error');
	}
};

// One response. The search ignores page, limit, and offset and returns at most 10 rows.
export const getNextProducts: GetNextProducts = () => {};
