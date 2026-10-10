import axios from '../axios.server';
import { headers } from '../constants';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { catalogHttpsUrl } from '../../safeCatalogUrl';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import type {
	UfiBox,
	UfiCrossSource,
	UfiDetailAura,
	UfiImages,
	UfiProductSource,
	UfiSize,
	UfiTotal
} from './ResponseSchema';

const CATALOG_ORIGIN = 'https://shop.ufi-aftermarket.com';
const AURA_URL = `${CATALOG_ORIGIN}/it/s/sfsites/aura`;
const IMAGE_PREFIX =
	'https://ufi-aftermarket.com/wp-content/plugins/ufi-search-wp-plugin/public/emea/';
const PAGE_CAP = 1000;
const DETAIL_CONCURRENCY = 8;
const HEIGHT = 'height';
const LARGEST_DIAMETER = 'largest diameter';
const BOTTOM_INNER_DIAMETER = 'inner diameter at the bottom';

// The shop accepts this fwuid until the community bundle is redeployed.
const AURA_CONTEXT = JSON.stringify({
	mode: 'PROD',
	fwuid: 'SGRNczhXdnNHNDNKUWhIdXFhdFJlUWtVMjdnTGFERUU2S3FfSVdrcU92bkExNS4zLjE2MDEw',
	app: 'siteforce:communityApp',
	loaded: {
		'APPLICATION@markup://siteforce:communityApp': '1888_-kKAFK7UHxK1kDSaicKEkw'
	},
	dn: [],
	globals: {},
	uad: true
});

const catalogHeaders = {
	...headers,
	Accept: '*/*',
	'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
	'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
	Origin: CATALOG_ORIGIN,
	Connection: 'keep-alive',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'cors',
	'Sec-Fetch-Site': 'same-origin',
	TE: 'trailers',
	'Sec-GPC': '1'
};

function trimmed(value: string | null | undefined): string | undefined {
	const text = value?.trim();
	return text || undefined;
}

function finiteNumber(value: number | string | undefined): number | undefined {
	const parsed =
		typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
	return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveMillimeters(entry: UfiSize | undefined): number | undefined {
	if (!entry) return undefined;
	const unit = entry.um?.trim().toLowerCase();
	if (unit && unit !== 'mm') return undefined;
	const parsed = finiteNumber(entry.value);
	if (parsed === undefined || parsed <= 0) return undefined;
	return parsed;
}

function sizeLabel(entry: UfiSize | undefined): string {
	return entry?.description?.en_EN?.trim().toLowerCase() ?? '';
}

function findSize(sizes: Record<string, UfiSize> | undefined, label: string): UfiSize | undefined {
	if (!sizes) return undefined;
	return Object.values(sizes).find((entry) => sizeLabel(entry) === label);
}

// A numeric "Outlet / thread size" is an outlet diameter in mm, not a thread.
function threadSize(sizes: Record<string, UfiSize> | undefined): string | undefined {
	if (!sizes) return undefined;
	const threads = Object.values(sizes).filter((entry) => sizeLabel(entry).includes('thread'));
	const textOf = (entry: UfiSize): string | undefined => {
		if (typeof entry.value !== 'string') return undefined;
		const text = entry.value.trim();
		if (!text || Number.isFinite(Number(text))) return undefined;
		return text;
	};
	const outlet = threads.find((entry) => sizeLabel(entry).startsWith('outlet') && textOf(entry));
	if (outlet) return textOf(outlet);
	const textual = threads.map(textOf).filter((text): text is string => text !== undefined);
	return textual.length === 1 ? textual[0] : undefined;
}

// A is "outer diameter / length" and B is "inner diameter at the top / width".
// Each English label names two measurements, so those letters stay unmapped.
function dimensionsFrom(
	sizes: Record<string, UfiSize> | undefined
): Product['dimensions'] | undefined {
	const externalDiameter = positiveMillimeters(findSize(sizes, LARGEST_DIAMETER));
	const internalDiameter = positiveMillimeters(findSize(sizes, BOTTOM_INNER_DIAMETER));
	const height = positiveMillimeters(findSize(sizes, HEIGHT));
	const thread = threadSize(sizes);
	if (
		externalDiameter === undefined &&
		internalDiameter === undefined &&
		height === undefined &&
		!thread
	) {
		return undefined;
	}
	const dimensions: Product['dimensions'] = {};
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	if (thread) dimensions.threadSize = thread;
	return dimensions;
}

function packagingFrom(box: UfiBox | undefined): Product['packaging'] | undefined {
	const width = finiteNumber(box?.w);
	const length = finiteNumber(box?.l);
	const height = finiteNumber(box?.h);
	if (
		width === undefined ||
		length === undefined ||
		height === undefined ||
		width <= 0 ||
		length <= 0 ||
		height <= 0
	) {
		return undefined;
	}
	return { width, length, height };
}

function imageUrl(path: string | undefined): string | undefined {
	const text = trimmed(path);
	if (!text) return undefined;
	const absolute = text.startsWith('http') ? text : IMAGE_PREFIX + text.replace(/^\//, '');
	return catalogHttpsUrl(absolute);
}

function thumbnails(images: UfiImages | undefined): string[] | undefined {
	if (!images) return undefined;
	const full = [images.image_dim?.path, images.image?.path];
	const thumbs = [images.image_dim?.thumb, images.image?.thumb];
	const paths = full.some((path) => trimmed(path)) ? full : thumbs;
	const urls: string[] = [];
	for (const path of paths) {
		const url = imageUrl(path);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function detailsUrl(code: string, id: string | undefined): string | undefined {
	const productId = trimmed(id);
	if (!productId) return undefined;
	const slug = encodeURIComponent(code.replaceAll('.', ''));
	return catalogHttpsUrl(
		`${CATALOG_ORIGIN}/s/product/${slug}/${encodeURIComponent(productId)}?language=en_US`
	);
}

function toProduct(row: UfiCrossSource): Product {
	const product: Product = {
		manufacturer: trimmed(row.manufacturer) ?? 'no manufacturer 🗿',
		manufacturer_code: trimmed(row.cross_code) ?? 'no manuf. code 🧐',
		source_reference_code: trimmed(row.filter) ?? 'no cross code 🧐'
	};
	const description = trimmed(row.description);
	if (description) product.description = description;
	const category = trimmed(row.application?.en_EN);
	if (category) product.category = category;
	return product;
}

function applyDetails(product: Product, source: UfiProductSource, id: string | undefined): void {
	const category = trimmed(source.family_name?.en_EN);
	if (category) product.category = category;
	const url = detailsUrl(source.code ?? product.source_reference_code, id);
	if (url) product.detailsUrl = url;
	const note = trimmed(source.public_note);
	if (note) product.longDescription = note;
	const images = thumbnails(source.images);
	if (images) product.thumbnails = images;
	const dimensions = dimensionsFrom(source.sizes);
	if (dimensions) product.dimensions = dimensions;
	const packaging = packagingFrom(source.box);
	if (packaging) product.packaging = packaging;
}

function totalOf(total: UfiTotal | undefined): { value: number; exact: boolean } | undefined {
	if (!total || typeof total.value !== 'number' || !Number.isFinite(total.value)) return undefined;
	return { value: total.value, exact: total.relation !== 'gte' };
}

function auraData(
	classname: string,
	method: string,
	params: Record<string, string | number>,
	pageURI: string
) {
	return {
		message: JSON.stringify({
			actions: [
				{
					id: '140;a',
					descriptor: 'aura://ApexActionController/ACTION$execute',
					callingDescriptor: 'UNKNOWN',
					params: {
						namespace: '',
						classname,
						method,
						params,
						cacheable: false,
						isContinuation: false
					}
				}
			]
		}),
		'aura.context': AURA_CONTEXT,
		'aura.pageURI': pageURI,
		'aura.token': 'null'
	};
}

function isCatalogCode(code: string): boolean {
	return code.toLowerCase() !== 'study';
}

async function addDetails(groups: Map<string, Product[]>, pageURI: string): Promise<void> {
	const entries = [...groups.entries()];
	if (entries.length === 0) return;
	let cursor = 0;

	async function worker(): Promise<void> {
		while (true) {
			const current = cursor++;
			if (current >= entries.length) return;
			const [code, products] = entries[current];
			try {
				const response = await axios.request<UfiDetailAura>({
					method: 'POST',
					url: AURA_URL,
					headers: catalogHeaders,
					data: auraData(
						'B2BProductDetailController',
						'getProductDetailByName',
						{ name: code },
						pageURI
					)
				});
				if (response.status >= 400) continue;
				const action = response.data?.actions?.[0];
				if (action?.state !== 'SUCCESS') continue;
				const detail = action.returnValue?.returnValue;
				const source = detail?.elasticsearchResult?.hits?.[0]?._source;
				if (!source || trimmed(source.code) !== code) continue;
				for (const product of products) applyDetails(product, source, detail?.id);
			} catch (error) {
				console.error('ufiam details', code, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, entries.length) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, PAGE_CAP);
	const safePage = page > 0 ? page : 1;
	const pageURI = `/it/s/catalogue?language=en_US&category=freeSearch&searchText=${encodeURIComponent(code)}`;
	const groups = new Map<string, Product[]>();
	const started = config?.showPerfReqProxyToSource ? Date.now() : undefined;

	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'ufiam',
			{
				method: 'POST',
				url: AURA_URL,
				headers: catalogHeaders,
				data: auraData(
					'B2B_CompetitorController',
					'getCompetitorsTable',
					{
						searchKey: code,
						nLimit: nItems,
						offset: (safePage - 1) * nItems
					},
					pageURI
				)
			},
			{
				rowsIterator: (resData) => {
					const hits = resData.actions?.[0]?.returnValue?.returnValue?.hits;
					if (!hits) return [];
					const products: Product[] = [];
					for (const hit of hits) {
						const row = hit._source;
						if (!row) continue;
						const product = toProduct(row);
						const filter = trimmed(row.filter);
						if (filter && isCatalogCode(filter)) {
							const list = groups.get(filter);
							if (list) list.push(product);
							else groups.set(filter, [product]);
						}
						products.push(product);
					}
					return products;
				},
				nPages: (resData) => {
					const total = totalOf(resData.actions?.[0]?.returnValue?.returnValue?.total);
					// A gte total is only a lower bound. Leaving pages unset lets load-more continue.
					if (!total?.exact || nItems <= 0) return undefined as unknown as number;
					return Math.ceil(total.value / nItems);
				},
				pagination: nItems,
				totalItems: (resData) => {
					const total = totalOf(resData.actions?.[0]?.returnValue?.returnValue?.total);
					if (!total) return undefined;
					return total.exact ? total.value : `${total.value}+`;
				}
			},
			config,
			safePage
		);
		if (productsData.meta.status < 400) await addDetails(groups, pageURI);
		if (started !== undefined) {
			productsData.meta.performanceTimings = { proxyToSource: Date.now() - started };
		}
		return productsData;
	} catch (err) {
		console.error('UFI-aftermarket error', err);
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
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
