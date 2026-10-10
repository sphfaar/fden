import type { GetNextProducts, GetProducts } from '../types';
import type IkronSchema from './ResponseSchema';
import axios from '#lib/product_sources/axios.server.js';
import { headers } from '#lib/product_sources/constants.js';
import { getJsonToProducts } from '#lib/product_sources/getJsonToProductsData.server.js';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';
import { parseHTML } from 'linkedom';

const CATALOG_ORIGIN = 'https://ikron.it';
// Public Ninja Tables dump. `limit_rows=0` is the whole sheet. It has no search parameter.
const TABLE_URL = `${CATALOG_ORIGIN}/wp-admin/admin-ajax.php`;
const PAGE_CAP = 100;
const FAMILY_CONCURRENCY = 4;
const GRADE_SEGMENT = /^([A-Z]{2})(\d{3})$/;
const MEDIA_LINE = /^(.*?)(\d+(?:\s*[,.-]\s*\d+)*)\s*(?:µm|μm|micron)\b/iu;
const SPEC_LABEL = /^(?:portata|pressione|media filtranti)\b/iu;
const PLACEHOLDER_IMAGE = /blank\.gif|loading\.gif|logo|favicon|icon-|360-degrees|\.svg(?:$|\?)/iu;
const FLOW_DIRECTION = [
	/dall['’]interno all['’]esterno/iu,
	/dall['’]esterno all['’]interno/iu,
	/da interno a esterno/iu,
	/da esterno a interno/iu
];

// Grade letters are the 2024 HF 502 ordering table. The micron list on the family page has to agree.
const MEDIA_PREFIX: Record<string, (material: string) => boolean> = {
	FG: (material) => /microfibra/iu.test(material),
	RP: (material) => /rinforzata/iu.test(material),
	SP: (material) => /cellulosa/iu.test(material) && !/rinforzata/iu.test(material),
	MI: (material) => /inox/iu.test(material),
	MS: (material) => /zincato/iu.test(material)
};

interface MediaLine {
	material: string;
	microns: number[];
}

interface FamilyPage {
	category?: string;
	description?: string;
	longDescription?: string;
	thumbnails?: string[];
	mediaLines: MediaLine[];
	flowDirection?: string;
}

const catalogHeaders = {
	...headers,
	Accept: 'application/json, text/plain, */*',
	'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
	Referer: `${CATALOG_ORIGIN}/cross-reference-chart/`
};

function cleanText(value: string | null | undefined): string | undefined {
	const text = value?.replaceAll(/\s+/gu, ' ').trim();
	return text || undefined;
}

function asRows(data: unknown): readonly IkronSchema[] {
	return Array.isArray(data) ? data : [];
}

function detailsUrl(link: string | undefined): string | undefined {
	if (!link) return undefined;
	const href = /href="([^"]+)"/iu.exec(link)?.[1];
	if (!href) return undefined;
	try {
		const url = new URL(href.replaceAll('&amp;', '&'), `${CATALOG_ORIGIN}/`);
		if (url.protocol === 'http:' && /(^|\.)ikron\.it$/iu.test(url.hostname))
			url.protocol = 'https:';
		return catalogHttpsUrl(url.href);
	} catch {
		return undefined;
	}
}

function productFromRow(row: IkronSchema, code: string): Product | undefined {
	if (!row?.value) return undefined;
	const manufacturer = cleanText(row.value.concorrente);
	const manufacturerCode = cleanText(row.value.codice);
	const sourceReferenceCode = cleanText(row.value.ikron);
	if (!manufacturer || !manufacturerCode || !sourceReferenceCode) return undefined;
	const needle = code.toLowerCase();
	if (
		!manufacturerCode.toLowerCase().includes(needle) &&
		!sourceReferenceCode.toLowerCase().includes(needle)
	) {
		return undefined;
	}
	const product: Product = {
		manufacturer,
		manufacturer_code: manufacturerCode,
		source_reference_code: sourceReferenceCode
	};
	const url = detailsUrl(row.value.link);
	if (url) product.detailsUrl = url;
	return product;
}

function matchingProducts(rows: readonly IkronSchema[] | undefined, code: string): Product[] {
	const products: Product[] = [];
	for (const row of asRows(rows)) {
		const product = productFromRow(row, code);
		if (product) products.push(product);
	}
	return products;
}

function gradeOf(code: string): { prefix: string; micron: number } | undefined {
	for (const segment of code.split('-').slice(1)) {
		const match = GRADE_SEGMENT.exec(segment);
		if (!match || match[1] === 'HF') continue;
		const micron = Number(match[2]);
		if (Number.isSafeInteger(micron) && micron > 0) return { prefix: match[1], micron };
	}
	return undefined;
}

function listedMicrons(list: string): number[] {
	const microns: number[] = [];
	for (const match of list.matchAll(/\d+/gu)) {
		const value = Number(match[0]);
		if (Number.isSafeInteger(value) && value > 0) microns.push(value);
	}
	return microns;
}

function mediaLine(line: string): MediaLine | undefined {
	const match = MEDIA_LINE.exec(line.trim());
	if (!match) return undefined;
	const material = match[1]
		.replace(/^media filtranti\s*:\s*/iu, '')
		.replace(/[:\s]+$/u, '')
		.trim();
	const microns = listedMicrons(match[2]);
	return !material || microns.length === 0 ? undefined : { material, microns };
}

function breakLines(element: Element): string[] {
	const lines: string[] = [];
	let buffer = '';
	const walk = (node: Node): void => {
		if (node.nodeType === 3) {
			buffer += node.textContent ?? '';
			return;
		}
		if (node.nodeName === 'BR') {
			lines.push(buffer);
			buffer = '';
			return;
		}
		for (const child of node.childNodes) walk(child);
	};
	walk(element);
	lines.push(buffer);
	return lines
		.map((line) => line.replaceAll(/\s+/gu, ' ').trim())
		.filter((line) => line.length > 0);
}

function paragraphs(element: Element): Element[] {
	const children: Element[] = [];
	for (const child of element.children) {
		if (child.tagName.toUpperCase() === 'P') children.push(child);
	}
	return children;
}

function introItem(document: Document): Element | undefined {
	const intro = document.querySelector('.intro__scheda');
	if (!intro) return undefined;
	for (const item of intro.querySelectorAll('.item')) {
		if (item.querySelector('h1, h5, p')) return item;
	}
	return undefined;
}

function paragraphText(element: Element): string | undefined {
	return cleanText(element.textContent);
}

function isSpecParagraph(element: Element): boolean {
	const label = cleanText(element.querySelector('strong')?.textContent);
	return label ? SPEC_LABEL.test(label) : false;
}

function flowDirection(text: string | undefined): string | undefined {
	if (!text) return undefined;
	for (const pattern of FLOW_DIRECTION) {
		const match = pattern.exec(text);
		if (match) return match[0].replaceAll('’', "'");
	}
	return undefined;
}

function isProductPhoto(url: string): boolean {
	return url.includes('/wp-content/uploads/') && !PLACEHOLDER_IMAGE.test(url);
}

function pushPhoto(urls: string[], value: string | null | undefined): void {
	const url = catalogHttpsUrl(value, `${CATALOG_ORIGIN}/`);
	if (!url || !isProductPhoto(url) || urls.includes(url)) return;
	urls.push(url);
}

function thumbnails(document: Document): string[] | undefined {
	const urls: string[] = [];
	pushPhoto(urls, document.querySelector('img.wp-post-image')?.getAttribute('src'));
	for (const image of document.querySelectorAll('.sp-slide img')) {
		const slide = image as HTMLImageElement;
		pushPhoto(urls, slide.dataset.src ?? slide.getAttribute('src'));
	}
	return urls.length > 0 ? urls : undefined;
}

function mediaLinesFrom(intro: Element): MediaLine[] {
	const lines: MediaLine[] = [];
	for (const paragraph of paragraphs(intro)) {
		const label = cleanText(paragraph.querySelector('strong')?.textContent);
		if (!label || !/^media filtranti\b/iu.test(label)) continue;
		for (const line of breakLines(paragraph)) {
			const parsed = mediaLine(line);
			if (parsed) lines.push(parsed);
		}
	}
	return lines;
}

function descriptionFrom(intro: Element): string | undefined {
	const parts: string[] = [];
	for (const paragraph of paragraphs(intro)) {
		if (isSpecParagraph(paragraph)) continue;
		const text = paragraphText(paragraph);
		if (text) parts.push(text);
	}
	return parts.length > 0 ? parts.join(' ') : undefined;
}

function longDescription(document: Document): string | undefined {
	const section = document.querySelector('.cont__scheda');
	if (!section) return undefined;
	for (const center of section.querySelectorAll('.cont__center')) {
		for (const child of center.children) {
			if (child.tagName.toUpperCase() !== 'P') continue;
			const text = paragraphText(child);
			if (text && text.length > 40) return text;
		}
	}
	return undefined;
}

function familyFromDocument(document: Document): FamilyPage {
	const intro = introItem(document);
	const description = intro ? descriptionFrom(intro) : undefined;
	const longer = longDescription(document);
	const flow = flowDirection([description, longer].filter(Boolean).join(' '));
	return {
		category: cleanText(document.querySelector('.intro__scheda h5')?.textContent),
		description,
		longDescription: longer && longer !== description ? longer : undefined,
		thumbnails: thumbnails(document),
		mediaLines: intro ? mediaLinesFrom(intro) : [],
		flowDirection: flow
	};
}

function specsFrom(
	code: string,
	lines: readonly MediaLine[],
	flow: string | undefined
): Product['specs'] | undefined {
	const grade = gradeOf(code);
	let chosen: MediaLine | undefined;
	if (grade) {
		const accepts = MEDIA_PREFIX[grade.prefix];
		const hits = lines.filter(
			(line) => line.microns.includes(grade.micron) && (accepts ? accepts(line.material) : true)
		);
		if (hits.length === 1) chosen = hits[0];
	} else if (lines.length === 1 && lines[0].microns.length === 1) {
		chosen = lines[0];
	}

	const specs: Product['specs'] = {};
	if (chosen) {
		specs.mediaType = chosen.material;
		if (grade && chosen.microns.includes(grade.micron)) specs.efficiency = `${grade.micron} µm`;
		else if (chosen.microns.length === 1) specs.efficiency = `${chosen.microns[0]} µm`;
	}
	if (flow) specs.flowDirection = flow;
	return !specs.mediaType && !specs.efficiency && !specs.flowDirection ? undefined : specs;
}

function applyFamily(product: Product, family: FamilyPage): void {
	if (family.category) product.category = family.category;
	if (family.description) product.description = family.description;
	if (family.longDescription) product.longDescription = family.longDescription;
	if (family.thumbnails) product.thumbnails = family.thumbnails;
	const specs = specsFrom(product.source_reference_code, family.mediaLines, family.flowDirection);
	if (specs) product.specs = specs;
}

async function familyPage(url: string): Promise<FamilyPage | undefined> {
	const response = await axios.request<string>({
		method: 'GET',
		url,
		responseType: 'text',
		headers: {
			...catalogHeaders,
			Accept: 'text/html,application/xhtml+xml'
		}
	});
	return response.status >= 400 || typeof response.data !== 'string'
		? undefined
		: familyFromDocument(parseHTML(response.data).document);
}

async function addFamily(pageByProduct: Map<Product, string>): Promise<void> {
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
				const family = await familyPage(url);
				if (!family) continue;
				for (const product of products) applyFamily(product, family);
			} catch (error) {
				console.error('ikron family page', url, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(FAMILY_CONCURRENCY, productsByUrl.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const offset = pageSize * (safePage - 1);
	const pageByProduct = new Map<Product, string>();

	try {
		const productsData = await getJsonToProducts<IkronSchema[]>(
			'ikron',
			{
				method: 'GET',
				url: TABLE_URL,
				params: {
					action: 'wp_ajax_ninja_tables_public_action',
					table_id: 1566,
					target_action: 'get-all-data',
					default_sorting: 'old_first',
					skip_rows: 0,
					limit_rows: 0
				},
				headers: catalogHeaders
			},
			{
				rowsIterator: (rows) => {
					const pageRows = matchingProducts(rows, code).slice(offset, offset + pageSize);
					for (const product of pageRows) {
						if (product.detailsUrl) pageByProduct.set(product, product.detailsUrl);
					}
					return pageRows;
				},
				nPages: (rows) => Math.ceil(matchingProducts(rows, code).length / pageSize),
				pagination: pageSize,
				totalItems: (rows) => matchingProducts(rows, code).length
			},
			config,
			safePage
		);
		if (productsData.meta.status < 400) await addFamily(pageByProduct);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'Ikron error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
