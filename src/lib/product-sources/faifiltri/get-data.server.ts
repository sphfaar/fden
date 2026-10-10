import type { GetNextProducts, GetProducts } from '../types';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getHtmlToProducts } from '#lib/product-sources/get-html-to-products-data.server.js';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { parseHTML } from 'linkedom';

const CATALOG_ORIGIN = 'https://www.faifiltri.it';
const SEARCH_URL = `${CATALOG_ORIGIN}/elenco_risultati_cross.php`;
const DETAIL_URL = `${CATALOG_ORIGIN}/cross_dettaglio.php`;
const LANGUAGE_ID = '318';
const PAGE_CAP = 100;
const DETAIL_CONCURRENCY = 6;

// Drawing callouts. The letter (A, B, C) is not the meaning; the value prefix is.
const EXTERNAL_DIAMETER = /^[\u{00D8}\u{2205}]\s*e:\s*(\d+(?:[.,]\d+)?)\s*mm\b/iu;
const INTERNAL_DIAMETER = /^[\u{00D8}\u{2205}]\s*i:\s*(\d+(?:[.,]\d+)?)\s*mm\b/iu;
const HEIGHT = /^H:\s*(\d+(?:[.,]\d+)?)\s*mm\b/iu;
const GASKET_DIAMETER = /^[\u{00D8}\u{2205}]\s*g:\s*(\d+(?:[.,]\d+)?)\s*mm\b/iu;
const THREAD =
	/^(?:M\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?|(?:\d+\s*)?\d+\s*\/\s*\d+\s*['\u{2032}\u{00B4}\u{2019}"]?\s*GAS|\d+\s*['\u{2032}\u{00B4}\u{2019}"]\s*GAS|G\s*(?:\d+\s*)?\d+(?:\s*\/\s*\d+)?|(?:\d+\s*['\u{2032}\u{00B4}\u{2019}"]\s*\d+\s*\/\s*\d+|(?:\d+\s*)?\d+\s*\/\s*\d+\s*['\u{2032}\u{00B4}\u{2019}"]?|\d+\s*['\u{2032}\u{00B4}\u{2019}"]|\d+(?:[.,]\d+)?)\s*-?\s*\d+(?:[.,]\d+)?\s*(?:UNF|UNC|UNS|UNEF|UN|NPTF|NPT|BSPT|BSPP|BSP)\b.*|(?:(?:\d+\s*)?\d+\s*\/\s*\d+|\d+)\s*['\u{2032}\u{00B4}\u{2019}"]?\s*(?:NPTF|NPT|BSPT|BSPP|BSP|GAS)\b.*)$/iu;

const catalogHeaders = {
	...headers,
	Accept: 'text/html,application/xhtml+xml',
	Referer: `${CATALOG_ORIGIN}/en/cross/`
};

interface DetailQuery {
	cdfai: string;
	costruttore: string;
	codiceCostruttore: string;
}

interface ListedProduct {
	product: Product;
	detail?: DetailQuery;
}

interface Sheet {
	specs?: Product['specs'];
	dimensions?: Product['dimensions'];
	thumbnails?: string[];
}

function clean(value: string | null | undefined): string | undefined {
	const text = value?.replaceAll(/\s+/gu, ' ').trim();
	return text || undefined;
}

function stated(value: string | undefined): string | undefined {
	return !value || value === '-' || value === '–' || value === '—' ? undefined : value;
}

function prefixedMillimeters(value: string, pattern: RegExp): number | undefined {
	const match = pattern.exec(value);
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function largest(values: number[]): number | undefined {
	return values.length > 0 ? Math.max(...values) : undefined;
}

function detailPageUrl(query: DetailQuery): string {
	const url = new URL(DETAIL_URL);
	url.searchParams.set('idlingua', LANGUAGE_ID);
	url.searchParams.set('cdfai', query.cdfai);
	url.searchParams.set('costruttore', query.costruttore);
	url.searchParams.set('codice_costruttore', query.codiceCostruttore);
	return url.href;
}

// `costruttore` stores a space as `**`. The cell text is what the catalog prints.
function listedProducts(
	tableRows: HTMLCollectionOf<Element> | NodeListOf<Element>
): ListedProduct[] {
	const listed: ListedProduct[] = [];
	for (const row of tableRows) {
		const card = row.querySelector('.scheda_cross');
		const manufacturer = clean(card?.textContent);
		const manufacturerCode = clean(
			row.querySelector(':scope > td:nth-child(2) > div')?.textContent
		);
		const sourceReferenceCode = clean(
			row.querySelector(':scope > td:nth-child(3) > div')?.textContent
		);
		if (!manufacturer || !manufacturerCode || !sourceReferenceCode) continue;
		const product: Product = {
			manufacturer,
			manufacturer_code: manufacturerCode,
			source_reference_code: sourceReferenceCode
		};
		const cdfai = clean(card?.getAttribute('codice'));
		const costruttore = card?.getAttribute('costruttore')?.trim();
		const codiceCostruttore = card?.getAttribute('codice_costruttore')?.trim();
		listed.push({
			product,
			detail:
				cdfai && costruttore && codiceCostruttore
					? { cdfai, costruttore, codiceCostruttore }
					: undefined
		});
	}
	return listed;
}

function labeledValues(document: Document): { label: string; value: string }[] {
	const rows: { label: string; value: string }[] = [];
	for (const row of document.querySelectorAll('.bb-grey')) {
		const label = clean(row.querySelector('.title-content')?.textContent);
		const value = stated(clean(row.querySelector('.body-content')?.textContent));
		if (label && value) rows.push({ label, value });
	}
	return rows;
}

function specsFrom(rows: { label: string; value: string }[]): Product['specs'] | undefined {
	let mediaType: string | undefined;
	let filtration: string | undefined;
	let separation: string | undefined;
	let flowDirection: string | undefined;
	for (const row of rows) {
		if (/^media\b/iu.test(row.label)) mediaType = row.value;
		else if (/filtration rating|grado filtrazione/iu.test(row.label)) filtration = row.value;
		else if (/separation efficiency|efficienza di separazione/iu.test(row.label))
			separation = row.value;
		else if (/flow direction|direzione del flusso/iu.test(row.label)) flowDirection = row.value;
	}
	const efficiency = [filtration, separation].filter(Boolean).join('; ');
	const specs: Product['specs'] = {};
	if (mediaType) specs.mediaType = mediaType;
	if (efficiency) specs.efficiency = efficiency;
	if (flowDirection) specs.flowDirection = flowDirection;
	return specs.mediaType || specs.efficiency || specs.flowDirection ? specs : undefined;
}

// Unlabeled millimeters, Ho, Øb, and A/F are not element size. Two Øg values are the
// gasket outside and inside diameters (larger, then smaller) on the spin-on drawing.
function dimensionsFrom(values: string[]): Product['dimensions'] | undefined {
	const external: number[] = [];
	const internal: number[] = [];
	const heights: number[] = [];
	const gaskets: number[] = [];
	const threads: string[] = [];
	for (const value of values) {
		const outside = prefixedMillimeters(value, EXTERNAL_DIAMETER);
		if (outside !== undefined) {
			external.push(outside);
			continue;
		}
		const inside = prefixedMillimeters(value, INTERNAL_DIAMETER);
		if (inside !== undefined) {
			internal.push(inside);
			continue;
		}
		const height = prefixedMillimeters(value, HEIGHT);
		if (height !== undefined) {
			heights.push(height);
			continue;
		}
		const gasket = prefixedMillimeters(value, GASKET_DIAMETER);
		if (gasket !== undefined) {
			gaskets.push(gasket);
			continue;
		}
		if (THREAD.test(value)) threads.push(value);
	}

	const dimensions: Product['dimensions'] = {};
	// Several Øe are stations on the drawing. The outside diameter is the largest.
	const externalDiameter = largest(external);
	const internalDiameter = largest(internal);
	const height = largest(heights);
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	const threadSize = [...new Set(threads)].join(' / ');
	if (threadSize) dimensions.threadSize = threadSize;
	const gasketSizes = [...new Set(gaskets)].toSorted((left, right) => left - right);
	if (gasketSizes.length === 2) {
		dimensions.gasketInternalDiameter = gasketSizes[0];
		dimensions.gasketExternalDiameter = gasketSizes[1];
	}
	return Object.keys(dimensions).length > 0 ? dimensions : undefined;
}

function thumbnails(document: Document): string[] | undefined {
	const urls: string[] = [];
	for (const image of document.querySelectorAll('img')) {
		const source = image.getAttribute('src');
		if (!source?.includes('/cross/immagini/')) continue;
		const url = catalogHttpsUrl(source, `${CATALOG_ORIGIN}/`);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function sheetFromHtml(html: string): Sheet | undefined {
	const { document } = parseHTML(html);
	const rows = labeledValues(document);
	const sheet: Sheet = {
		specs: specsFrom(rows),
		dimensions: dimensionsFrom(rows.map((row) => row.value)),
		thumbnails: thumbnails(document)
	};
	return sheet.specs || sheet.dimensions || sheet.thumbnails ? sheet : undefined;
}

function applySheet(product: Product, sheet: Sheet): void {
	if (sheet.specs) product.specs = sheet.specs;
	if (sheet.dimensions) product.dimensions = sheet.dimensions;
	if (sheet.thumbnails) product.thumbnails = sheet.thumbnails;
}

async function sheetFor(cdfai: string, pageUrl: string): Promise<Sheet | undefined> {
	try {
		const response = await axios.request<string>({
			method: 'GET',
			url: pageUrl,
			responseType: 'text',
			headers: catalogHeaders
		});
		return response.status >= 400 || typeof response.data !== 'string'
			? undefined
			: sheetFromHtml(response.data);
	} catch (error) {
		console.error('faifiltri details', cdfai, error);
		return undefined;
	}
}

async function addDetails(detailByProduct: Map<Product, DetailQuery>): Promise<void> {
	const productsByCode = new Map<string, { pageUrl: string; products: Product[] }>();
	for (const [product, query] of detailByProduct) {
		const href = catalogHttpsUrl(detailPageUrl(query));
		if (href) product.detailsUrl = href;
		const group = productsByCode.get(query.cdfai) ?? {
			pageUrl: detailPageUrl(query),
			products: []
		};
		group.products.push(product);
		productsByCode.set(query.cdfai, group);
	}
	if (productsByCode.size === 0) return;

	const pending = productsByCode.entries();
	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [cdfai, group] = next.value;
			const sheet = await sheetFor(cdfai, group.pageUrl);
			if (!sheet) continue;
			for (const product of group.products) applySheet(product, sheet);
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsByCode.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const offset = pageSize * (safePage - 1);
	const detailByProduct = new Map<Product, DetailQuery>();
	// One HTML document lists every match. The catalog does not accept a page argument.
	let matches: ListedProduct[] | undefined;

	function allMatches(tableRows: HTMLCollectionOf<Element> | NodeListOf<Element>): ListedProduct[] {
		matches ??= listedProducts(tableRows);
		return matches;
	}

	try {
		const productsData = await getHtmlToProducts(
			'faifiltri',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: { idlingua: LANGUAGE_ID, codice_costruttore: code },
				headers: {
					...catalogHeaders,
					'Sec-GPC': 1
				}
			},
			{
				tableRows: (document) => document.querySelectorAll('.table > tbody > tr'),
				rowsIterator: (tableRows) => {
					const pageRows = allMatches(tableRows).slice(offset, offset + pageSize);
					for (const row of pageRows) {
						if (row.detail) detailByProduct.set(row.product, row.detail);
					}
					return pageRows.map((row) => row.product);
				},
				nPages: (document) =>
					Math.ceil(allMatches(document.querySelectorAll('.table > tbody > tr')).length / pageSize),
				totalItems: (document) =>
					allMatches(document.querySelectorAll('.table > tbody > tr')).length
			},
			config,
			safePage,
			pageSize
		);
		if (productsData.meta.status < 400) await addDetails(detailByProduct);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'Faifiltri error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
