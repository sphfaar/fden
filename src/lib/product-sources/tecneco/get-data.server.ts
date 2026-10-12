import type { GetNextProducts, GetProducts } from '../types';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getHtmlToProducts } from '#lib/product-sources/get-html-to-products-data.server.js';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import { parseHTML } from 'linkedom';

const CATALOG_ORIGIN = 'https://www.tecneco.it';
const SEARCH_URL = `${CATALOG_ORIGIN}/index.php`;
const PAGE_CAP = 100;
const DETAIL_CONCURRENCY = 6;

const catalogHeaders = {
	...headers,
	Accept: 'text/html,application/xhtml+xml',
	'Accept-Language': 'en',
	Referer: `${CATALOG_ORIGIN}/`
};

interface SheetQuery {
	filtro: string;
	codart: string;
}

interface ListedProduct {
	product: Product;
	detail?: SheetQuery;
}

interface Sheet {
	category?: string;
	description?: string;
	longDescription?: string;
	specs?: Product['specs'];
	thumbnails?: string[];
}

function clean(value: string | null | undefined): string | undefined {
	const text = value?.replaceAll(/\s+/gu, ' ').trim();
	return text || undefined;
}

function stated(value: string | undefined): string | undefined {
	return !value || /^(?:-|–|—|n\/a|soon available|presto disponibile(?:\s*\/)?)$/iu.test(value)
		? undefined
		: value;
}

// "VOLVO (TRUCKS/VCE/VME/PENTA) 11110152" and "WEBASTO - SPHEROS 11117394A".
// The manufacturer keeps its spaces. The code is the last token.
function competitorParts(
	text: string | undefined
): { manufacturer: string; code: string } | undefined {
	if (!text) return undefined;
	const splitAt = text.lastIndexOf(' ');
	if (splitAt <= 0) return undefined;
	const manufacturer = text.slice(0, splitAt).trim();
	const code = text.slice(splitAt + 1).trim();
	return !manufacturer || !code ? undefined : { manufacturer, code };
}

function sheetQuery(onclick: string | null | undefined): SheetQuery | undefined {
	if (!onclick) return undefined;
	const match = /filtro=(\d+)&codart=([^&'"\s]+)/u.exec(onclick);
	if (!match) return undefined;
	let codart: string;
	try {
		codart = decodeURIComponent(match[2]);
	} catch {
		return undefined;
	}
	return /^[\w./-]+$/u.test(codart) ? { filtro: match[1], codart } : undefined;
}

function sheetUrl(query: SheetQuery): string {
	const url = new URL(SEARCH_URL);
	url.searchParams.set('ctrl', 'CatalogOnline');
	url.searchParams.set('mod', 'catalogoOnline');
	url.searchParams.set('action', 'get_scheda_filtro');
	url.searchParams.set('filtro', query.filtro);
	url.searchParams.set('codart', query.codart);
	url.searchParams.set('lang', 'en');
	return url.href;
}

function listedProducts(
	tableRows: HTMLCollectionOf<Element> | NodeListOf<Element>
): ListedProduct[] {
	const listed: ListedProduct[] = [];
	for (const row of tableRows) {
		const competitor = competitorParts(
			clean(row.querySelector(':scope > .filter-name > span')?.textContent)
		);
		const detail = sheetQuery(row.querySelector(':scope > .filter-name')?.getAttribute('onclick'));
		if (!competitor || !detail) continue;
		listed.push({
			product: {
				manufacturer: competitor.manufacturer,
				manufacturer_code: competitor.code,
				source_reference_code: detail.codart
			},
			detail
		});
	}
	return listed;
}

function labeledValues(document: Document): { label: string; value: string }[] {
	const rows: { label: string; value: string }[] = [];
	const column = document.querySelector('.col-filter-features');
	if (!column) return rows;
	for (const block of column.querySelectorAll('.filter-info')) {
		const label = clean(block.querySelector('strong')?.textContent);
		const value = stated(clean(block.querySelector('p')?.textContent));
		if (label && value) rows.push({ label, value });
	}
	return rows;
}

function valueFor(rows: { label: string; value: string }[], label: string): string | undefined {
	return rows.find(
		(row) => row.label.localeCompare(label, undefined, { sensitivity: 'accent' }) === 0
	)?.value;
}

function sheetFromRows(rows: { label: string; value: string }[]): Omit<Sheet, 'thumbnails'> {
	const category = valueFor(rows, 'Type');
	const model = valueFor(rows, 'Model');
	const family = valueFor(rows, 'Family');
	const application = valueFor(rows, 'Main Application');
	const extra = [family, application].filter((part) => part && part !== model);
	const longDescription =
		extra.length > 0
			? [model, ...extra].filter((part) => part !== undefined).join(' | ')
			: undefined;
	const specs: Product['specs'] = {};
	const efficiency = valueFor(rows, 'Efficiency');
	const flowDirection = valueFor(rows, 'Flow Direction');
	if (efficiency) specs.efficiency = efficiency;
	if (flowDirection) specs.flowDirection = flowDirection;
	return {
		category,
		description: model,
		longDescription,
		specs: specs.efficiency || specs.flowDirection ? specs : undefined
	};
}

function thumbnails(document: Document): string[] | undefined {
	const column = document.querySelector('.col-filter-img');
	if (!column) return undefined;
	const urls: string[] = [];
	for (const anchor of column.querySelectorAll('a')) {
		const url = catalogHttpsUrl(anchor.getAttribute('href'), `${CATALOG_ORIGIN}/`);
		if (url && !urls.includes(url)) urls.push(url);
	}
	for (const image of column.querySelectorAll('img')) {
		const url = catalogHttpsUrl(image.getAttribute('src'), `${CATALOG_ORIGIN}/`);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function filtroId(document: Document): string | undefined {
	const href = document.querySelector('a.download-pdf')?.getAttribute('href');
	const match = href ? /[?&]filtro=(\d+)/u.exec(href) : undefined;
	return match?.[1];
}

function brandNames(document: Document): Map<string, string> {
	const names = new Map<string, string>();
	for (const option of document.querySelectorAll('#select_contenente_concorrenti option')) {
		const value = option.getAttribute('value')?.trim();
		const name = clean(option.textContent);
		if (!value || value === '0' || !name) continue;
		names.set(value, name);
	}
	return names;
}

// A single hit skips the choose-filter list and opens the sheet. The cross list on
// that sheet is every equivalent, so keep only codes that contain the query.
function directSheetProducts(document: Document, code: string): ListedProduct[] {
	const codart = clean(document.querySelector('.col-filter-features h2')?.textContent);
	if (!codart || !/^[\w./-]+$/u.test(codart)) return [];
	const filtro = filtroId(document);
	const detail = filtro ? { filtro, codart } : undefined;
	const brands = brandNames(document);
	const needle = code.toLowerCase();
	const sheet = sheetFromDocument(document);
	const listed: ListedProduct[] = [];
	for (const item of document.querySelectorAll('li.filtri_concorrenti')) {
		const manufacturerCode = clean(item.querySelector(':scope > span')?.textContent);
		if (!manufacturerCode?.toLowerCase().includes(needle)) continue;
		const classes = new Set((item.getAttribute('class') ?? '').split(/\s+/u));
		let manufacturer: string | undefined;
		for (const [value, name] of brands) {
			if (classes.has(`filtri_${value}`)) manufacturer = name;
		}
		if (!manufacturer) continue;
		const product: Product = {
			manufacturer,
			manufacturer_code: manufacturerCode,
			source_reference_code: codart
		};
		if (sheet) applySheet(product, sheet);
		listed.push({ product, detail });
	}
	return listed;
}

function sheetFromDocument(document: Document): Sheet | undefined {
	const parsed = sheetFromRows(labeledValues(document));
	if (!parsed.category) {
		const heading = stated(clean(document.querySelector('.col-filter-features > h6')?.textContent));
		if (heading) parsed.category = heading;
	}
	const sheet: Sheet = {
		...parsed,
		thumbnails: thumbnails(document)
	};
	return sheet.category ||
		sheet.description ||
		sheet.longDescription ||
		sheet.specs ||
		sheet.thumbnails
		? sheet
		: undefined;
}

function sheetFromHtml(html: string): Sheet | undefined {
	const { document } = parseHTML(html);
	return sheetFromDocument(document);
}

function applySheet(product: Product, sheet: Sheet): void {
	if (sheet.category) product.category = sheet.category;
	if (sheet.description) product.description = sheet.description;
	if (sheet.longDescription) product.longDescription = sheet.longDescription;
	if (sheet.specs) product.specs = sheet.specs;
	if (sheet.thumbnails) product.thumbnails = sheet.thumbnails;
}

async function sheetFor(query: SheetQuery): Promise<Sheet | undefined> {
	try {
		const response = await axios.request<string>({
			method: 'GET',
			url: sheetUrl(query),
			responseType: 'text',
			headers: catalogHeaders
		});
		return response.status >= 400 || typeof response.data !== 'string'
			? undefined
			: sheetFromHtml(response.data);
	} catch (error) {
		console.error('tecneco details', query.codart, error);
		return undefined;
	}
}

async function addDetails(detailByProduct: Map<Product, SheetQuery>): Promise<void> {
	const productsBySheet = new Map<string, { query: SheetQuery; products: Product[] }>();
	for (const [product, query] of detailByProduct) {
		const href = catalogHttpsUrl(sheetUrl(query));
		if (href) product.detailsUrl = href;
		const key = `${query.filtro}\n${query.codart}`;
		const group = productsBySheet.get(key) ?? { query, products: [] };
		group.products.push(product);
		productsBySheet.set(key, group);
	}
	if (productsBySheet.size === 0) return;

	const pending = productsBySheet.values();
	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const group = next.value;
			const sheet = await sheetFor(group.query);
			if (!sheet) continue;
			for (const product of group.products) applySheet(product, sheet);
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsBySheet.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const offset = pageSize * (safePage - 1);
	const detailByProduct = new Map<Product, SheetQuery>();
	// One HTML document lists every match. The catalog ignores a page argument.
	let matches: ListedProduct[] | undefined;

	function allMatches(document: Document): ListedProduct[] {
		if (matches === undefined) {
			const rows = document.querySelectorAll('.choose-filter li.filter');
			matches = rows.length > 0 ? listedProducts(rows) : directSheetProducts(document, code);
		}
		return matches;
	}

	try {
		const productsData = await getHtmlToProducts(
			'tecneco',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: {
					ctrl: 'CatalogOnline',
					mod: 'catalogoOnline',
					action: 'get_scheda_filtro',
					codice_concorrente: code,
					lang: 'en'
				},
				headers: catalogHeaders
			},
			{
				tableRows: (document) => document.querySelectorAll('.choose-filter li.filter'),
				// getHtmlToProducts calls nPages before rowsIterator, which fills `matches`.
				rowsIterator: () => {
					const pageRows = (matches ?? []).slice(offset, offset + pageSize);
					for (const row of pageRows) {
						if (row.detail) detailByProduct.set(row.product, row.detail);
					}
					return pageRows.map((row) => row.product);
				},
				nPages: (document) => Math.ceil(allMatches(document).length / pageSize),
				totalItems: (document) => allMatches(document).length
			},
			config,
			safePage,
			pageSize
		);
		if (productsData.meta.status < 400) await addDetails(detailByProduct);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'Tecneco error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
