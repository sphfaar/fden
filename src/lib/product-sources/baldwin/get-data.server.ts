import type { GetNextProducts, GetProducts } from '../types';
import type BaldwinSchema from './response-schema';
import type { BaldwinPartDocument, BaldwinPartSchema, CrossReferenceDocument } from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const SEARCH_URL = 'https://api.parker.com/prod/baldwinsearch/BaldwinECatalog/select';
const DETAILS_ORIGIN = 'https://ph.parker.com/us/en/';
const PRODUCT_PAGE_ORIGIN = 'https://products.parker.com/us/en/';
const ZOOM_DIRECTORY =
	'https://www.parker.com/content/dam/Parker-com/Online/Product-Images/Engine-Mobile-Aftermarket-Division/zoom_1000x1000/';
// Public vendor key. The old baldwinfilters.com POST only forwarded this to the same select.
const SUBSCRIPTION_KEY = 'a61a00f528344ce29179af297ccbbea8';
const PAGE_CAP = 1000;
const PART_BATCH = 40;
const SERIES_CONCURRENCY = 4;
const MILLIMETERS = /^\d+(?:\.\d+)?$/;

const searchHeaders = {
	...headers,
	Accept: 'application/json',
	'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
};

interface SeriesPage {
	category?: string;
	longDescription?: string;
	imagePrefix?: string;
}

function text(value: string | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function plainText(value: string | undefined): string | undefined {
	const raw = text(value);
	if (!raw) return undefined;
	const stripped = raw
		.replaceAll(/<br\s*\/?>/gi, ' ')
		.replaceAll(/<[^>]+>/g, ' ')
		.replaceAll('&amp;', '&')
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&#39;', "'")
		.replaceAll('&quot;', '"')
		.replaceAll(/\s+/g, ' ')
		.trim();
	return stripped.length > 0 ? stripped : undefined;
}

function pageSizeOf(maxItems: number): number {
	return Math.max(1, Math.min(maxItems, PAGE_CAP));
}

function solrPhrase(value: string): string {
	const escaped = value.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`);
	return `"${escaped}"`;
}

// A single millimeter. Ranges ("142.9 to 327.0") and paired axes stay unparsed.
function millimeters(value: string | undefined): number | undefined {
	const raw = text(value);
	if (!raw || !MILLIMETERS.test(raw)) return undefined;
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// Catalog thread size is `3/4-16` or a metric string such as `M20 x 1.5`.
function threadSize(part: BaldwinPartDocument): string | undefined {
	const thread = text(part.thread_si);
	const perInch = text(part.perInch_si);
	return thread && perInch ? `${thread}-${perInch}` : thread;
}

function crossDetailsUrl(urlKeyword: string | undefined): string | undefined {
	const keyword = text(urlKeyword);
	return keyword ? catalogHttpsUrl(keyword, DETAILS_ORIGIN) : undefined;
}

function seriesSlug(urlKeyword: string | undefined): string | undefined {
	const keyword = text(urlKeyword);
	if (!keyword) return undefined;
	const segments = keyword.split('/').filter((segment) => segment.length > 0);
	return segments.length >= 2 && segments[0] === 'product' ? segments[1] : undefined;
}

function productPageUrl(urlKeyword: string): string {
	const path = urlKeyword
		.split('/')
		.filter((segment) => segment.length > 0)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `${PRODUCT_PAGE_ORIGIN}${path}`;
}

function zoomUrl(prefix: string, partNumber: string): string | undefined {
	return catalogHttpsUrl(`${ZOOM_DIRECTORY}${prefix}_${encodeURIComponent(partNumber)}_zm.jpg`);
}

// Last resort when the series page does not load. Hyphenated series words such as Spin-on are wrong here.
function fallbackThumbnail(urlKeyword: string | undefined, partNumber: string): string | undefined {
	const keyword = text(urlKeyword)?.replaceAll(/\s/g, '');
	if (!keyword) return undefined;
	const segments = keyword.split('/').slice(1);
	const series = segments[0];
	if (!series) return undefined;
	const processed = series
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('_')
		.replace('Baldwin_In_', 'Baldwin_In-');
	const second = segments[1] ? `_${segments[1].toUpperCase()}` : '';
	return zoomUrl(`${processed}${second}`, partNumber);
}

function readJsString(source: string, quoteIndex: number): string | undefined {
	if (source[quoteIndex] !== '"') return undefined;
	let index = quoteIndex + 1;
	let decoded = '';
	while (index < source.length) {
		const character = source[index];
		if (character === '\\') {
			const next = source[index + 1];
			if (next === undefined) return undefined;
			if (next === 'u') {
				const hex = source.slice(index + 2, index + 6);
				if (!/^[\da-f]{4}$/i.test(hex)) return undefined;
				decoded += String.fromCodePoint(Number.parseInt(hex, 16));
				index += 6;
				continue;
			}
			const mapped: Record<string, string> = {
				'"': '"',
				'\\': '\\',
				'/': '/',
				b: '\b',
				f: '\f',
				n: '\n',
				r: '\r',
				t: '\t',
				"'": "'"
			};
			decoded += mapped[next] ?? next;
			index += 2;
			continue;
		}
		if (character === '"') return decoded;
		decoded += character;
		index += 1;
	}
	return undefined;
}

function productPayload(html: string): string | undefined {
	const marker = 'self.__next_f.push([1,';
	let from = 0;
	while (from < html.length) {
		const at = html.indexOf(marker, from);
		if (at === -1) return undefined;
		const decoded = readJsString(html, at + marker.length);
		if (decoded?.includes('"productdata":')) return decoded;
		from = at + marker.length;
	}
	return undefined;
}

function jsonStringField(payload: string, key: string, from = 0): string | undefined {
	const marker = `"${key}":"`;
	const start = payload.indexOf(marker, from);
	if (start === -1) return undefined;
	let index = start + marker.length;
	let raw = '';
	while (index < payload.length) {
		const character = payload[index];
		if (character === '\\') {
			raw += payload.slice(index, index + 2);
			index += 2;
			continue;
		}
		if (character === '"') break;
		raw += character;
		index += 1;
	}
	try {
		const parsed: unknown = JSON.parse(`"${raw}"`);
		return typeof parsed === 'string' ? text(parsed) : undefined;
	} catch {
		return undefined;
	}
}

function imagePrefix(imageUrl: string, partNumber: string): string | undefined {
	const fileName = imageUrl.split('/').pop() ?? '';
	const suffix = `_${partNumber}_zm.jpg`;
	if (!fileName.endsWith(suffix)) return undefined;
	const prefix = fileName.slice(0, -suffix.length);
	return prefix.length > 0 ? prefix : undefined;
}

function parseSeriesPage(html: string, partNumber: string): SeriesPage {
	const payload = productPayload(html);
	if (!payload) return {};
	const scope = Math.max(payload.indexOf('"productdata":'), 0);
	const category = jsonStringField(payload, 'name', scope);
	const longDescription = plainText(jsonStringField(payload, 'information', scope));
	const image = jsonStringField(payload, 'image', scope);
	const printedPart = jsonStringField(payload, 'part-number', scope) ?? partNumber;
	const absoluteImage = image?.startsWith('//') ? `https:${image}` : image;
	const prefix = absoluteImage ? imagePrefix(absoluteImage, printedPart) : undefined;
	return {
		category,
		longDescription,
		imagePrefix: prefix
	};
}

function applyPart(product: Product, part: BaldwinPartDocument | undefined): void {
	if (!part) return;
	const description = text(part.description_si);
	if (description) product.description = description;
	const efficiency = text(part.micronRating_si);
	if (efficiency) product.specs = { efficiency };

	const externalDiameter = millimeters(part.od1mm_si);
	const internalDiameter = millimeters(part.id1mm_si);
	const height = millimeters(part.lengthmm_si);
	const thread = threadSize(part);
	if (
		externalDiameter === undefined &&
		internalDiameter === undefined &&
		height === undefined &&
		!thread
	) {
		return;
	}
	product.dimensions = {};
	if (externalDiameter !== undefined) product.dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) product.dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) product.dimensions.height = height;
	if (thread) product.dimensions.threadSize = thread;
}

function applySeries(
	product: Product,
	series: SeriesPage | undefined,
	seriesKeyword: string | undefined
): void {
	const partNumber = product.source_reference_code;
	if (series?.category) product.category = series.category;
	if (series?.longDescription && series.longDescription !== product.description) {
		product.longDescription = series.longDescription;
	}
	const thumbnail = series?.imagePrefix
		? zoomUrl(series.imagePrefix, partNumber)
		: fallbackThumbnail(seriesKeyword, partNumber);
	if (thumbnail) product.thumbnails = [thumbnail];
}

function toProduct(row: CrossReferenceDocument): Product | undefined {
	const manufacturer = text(row.manufacturer_s);
	const manufacturerCode = text(row.partNumber_s);
	const reference = text(row.code_si);
	if (!manufacturer || !manufacturerCode || !reference) return undefined;
	const product: Product = {
		manufacturer,
		manufacturer_code: manufacturerCode,
		source_reference_code: reference
	};
	const detailsUrl = crossDetailsUrl(row.urlKeyword_si);
	if (detailsUrl) product.detailsUrl = detailsUrl;
	return product;
}

function crossReferenceRows(body: BaldwinSchema): {
	documents: CrossReferenceDocument[];
	totalItems: number;
} {
	const group = Object.values(body.grouped ?? {}).find((entry) => entry?.doclist);
	const documents = group?.doclist?.docs ?? [];
	const totalItems = group?.doclist?.numFound ?? documents.length;
	return { documents, totalItems };
}

async function loadParts(partNumbers: string[]): Promise<Map<string, BaldwinPartDocument>> {
	const parts = new Map<string, BaldwinPartDocument>();
	if (partNumbers.length === 0) return parts;
	for (let index = 0; index < partNumbers.length; index += PART_BATCH) {
		const batch = partNumbers.slice(index, index + PART_BATCH);
		const query = `baldwinPartId_s:(${batch.map((partNumber) => solrPhrase(partNumber)).join(' OR ')})`;
		try {
			const response = await axios.request<BaldwinPartSchema>({
				method: 'GET',
				url: SEARCH_URL,
				params: {
					fq: 'coreName_s:BaldwinPartData',
					q: query,
					rows: batch.length,
					wt: 'json'
				},
				headers: searchHeaders,
				timeout: 15_000,
				validateStatus: () => true
			});
			if (response.status >= 400) continue;
			const documents = response.data.response?.docs ?? [];
			for (const part of documents) {
				const partNumber = text(part.baldwinPartId_s);
				if (partNumber) parts.set(partNumber, part);
			}
		} catch (error) {
			console.error('baldwin parts', error);
		}
	}
	return parts;
}

async function loadSeries(
	pages: Map<string, { urlKeyword: string; partNumber: string }>
): Promise<Map<string, SeriesPage>> {
	const series = new Map<string, SeriesPage>();
	const entries = pages.entries().toArray();
	if (entries.length === 0) return series;
	let index = 0;

	async function worker(): Promise<void> {
		while (index < entries.length) {
			const current = index;
			index += 1;
			const [slug, page] = entries[current];
			try {
				const response = await axios.request<string>({
					method: 'GET',
					url: productPageUrl(page.urlKeyword),
					headers: { ...headers, Accept: 'text/html' },
					responseType: 'text',
					timeout: 15_000,
					validateStatus: () => true
				});
				if (response.status >= 400 || typeof response.data !== 'string') continue;
				series.set(slug, parseSeriesPage(response.data, page.partNumber));
			} catch (error) {
				console.error('baldwin series', slug, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(SERIES_CONCURRENCY, entries.length) }, () =>
		worker()
	);
	await Promise.all(workers);
	return series;
}

function emptyFailure(): ProductsData {
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

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = pageSizeOf(maxItems);
	const safePage = page > 0 ? page : 1;
	const formattedCode = code.replaceAll(/[^\w]/g, '').toUpperCase();
	if (!formattedCode) {
		return {
			meta: {
				status: 200,
				currentItemsDisplayed: 0,
				totalItems: 0,
				page: safePage,
				pages: 0,
				maxItemsPagination: pageSize
			},
			products: []
		};
	}

	const competitor = `compPartId_s:(${solrPhrase(formattedCode)} OR ${formattedCode}* OR *${formattedCode}*)`;
	const started = config?.showPerfReqProxyToSource ? Date.now() : undefined;

	try {
		const response = await axios.request<BaldwinSchema>({
			method: 'GET',
			url: SEARCH_URL,
			params: {
				fq: 'coreName_s:BaldwinCrossRefData',
				wt: 'json',
				group: 'true',
				'group.offset': pageSize * (safePage - 1),
				'group.limit': pageSize,
				'group.query': competitor,
				q: `${competitor}^1 OR partNumber_s:(${solrPhrase(formattedCode)} OR ${formattedCode}*)^2`
			},
			headers: searchHeaders,
			timeout: 15_000,
			validateStatus: () => true
		});
		if (response.status >= 400) {
			return {
				meta: {
					status: response.status,
					currentItemsDisplayed: 0,
					page: 0
				},
				products: []
			};
		}

		const { documents, totalItems } = crossReferenceRows(response.data);
		const products: Product[] = [];
		const seriesPages = new Map<string, { urlKeyword: string; partNumber: string }>();
		const seriesByProduct: (string | undefined)[] = [];
		const keywords: (string | undefined)[] = [];
		for (const row of documents) {
			const product = toProduct(row);
			if (!product) continue;
			products.push(product);
			const slug = seriesSlug(row.urlKeyword_si);
			seriesByProduct.push(slug);
			keywords.push(row.psURLKeyword_si);
			const keyword = text(row.urlKeyword_si);
			if (slug && keyword && !seriesPages.has(slug)) {
				seriesPages.set(slug, { urlKeyword: keyword, partNumber: product.source_reference_code });
			}
		}

		const partNumbers = [...new Set(products.map((product) => product.source_reference_code))];
		const [parts, series] = await Promise.all([
			loadParts(partNumbers),
			loadSeries(seriesPages)
		]);
		for (const [index, product] of products.entries()) {
			applyPart(product, parts.get(product.source_reference_code));
			const slug = seriesByProduct[index];
			applySeries(product, slug ? series.get(slug) : undefined, keywords[index]);
		}

		const elapsed = started === undefined ? undefined : Date.now() - started;
		return {
			meta: {
				status: response.status,
				currentItemsDisplayed: products.length,
				totalItems,
				page: safePage,
				pages: Math.ceil(totalItems / pageSize),
				maxItemsPagination: pageSize,
				performanceTimings: elapsed === undefined ? undefined : { proxyToSource: elapsed }
			},
			products
		};
	} catch (error) {
		console.error('baldwin error', error);
		return emptyFailure();
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page = 1) =>
	getProducts(code, maxItems, config, page + 1);
