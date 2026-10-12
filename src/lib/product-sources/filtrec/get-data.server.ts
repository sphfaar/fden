import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import type {
	Datum,
	FiltrecDetailsBeta,
	FiltrecDetailsSchema,
	FiltrecMedia
} from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const CATALOG_ORIGIN = 'https://cross-navigator.filtrec.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/api/cross-reference/search`;
const LOCALE = 'it';
const DETAIL_CONCURRENCY = 8;

const catalogHeaders = {
	...headers,
	Host: 'cross-navigator.filtrec.com',
	Accept: 'application/json',
	'Accept-Language': 'en-US,en;q=0.5',
	Referer: 'https://www.filtrec.com/',
	Origin: 'https://www.filtrec.com',
	'Sec-GPC': '1',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'no-cors',
	'Sec-Fetch-Site': 'same-site',
	Priority: 'u=0',
	Pragma: 'no-cache',
	'Cache-Control': 'no-cache',
	TE: 'trailers'
};

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function positive(value: number | null | undefined): number | undefined {
	return typeof value !== 'number' || !Number.isFinite(value) || value <= 0 ? undefined : value;
}

// The catalog prints efficiency as HTML, for example `10 µm<sub>(c)</sub> βx ≥ 200`.
function plain(value: string | null | undefined): string | undefined {
	const raw = text(value);
	if (!raw) return undefined;
	const stripped = decode(raw.replaceAll(/<[^>]*>/gu, ''))
		.replaceAll(/\s+/gu, ' ')
		.trim();
	return stripped.length > 0 ? stripped : undefined;
}

function decode(value: string): string {
	return value
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
}

function mediaType(beta: FiltrecMedia | null | undefined): string | undefined {
	return text(beta?.mediaEng) ?? text(beta?.media);
}

function efficiencyText(beta: FiltrecDetailsBeta | null | undefined): string | undefined {
	const parts: string[] = [];
	const first = plain(beta?.efficiency1);
	const second = plain(beta?.efficiency2);
	if (first) parts.push(first);
	if (second) parts.push(second);
	return parts.length > 0 ? parts.join('; ') : undefined;
}

// Public datasheet path. `/` in a Filtrec code becomes `-`.
function codePath(productCode: string): string {
	return productCode.replaceAll('/', '-');
}

function datasheetUrl(productCode: string): string | undefined {
	return catalogHttpsUrl(`${CATALOG_ORIGIN}/product/${codePath(productCode)}/pdf?locale=${LOCALE}`);
}

function toProduct(row: Datum): Product {
	const product: Product = {
		manufacturer: row.manufacturer,
		manufacturer_code: row.code,
		source_reference_code: row.productCode
	};
	const detailsUrl = datasheetUrl(row.productCode);
	if (detailsUrl) product.detailsUrl = detailsUrl;

	const item = row.product;
	if (!item) return product;

	const thumbnail = catalogHttpsUrl(item.image?.url);
	if (thumbnail) product.thumbnails = [thumbnail];

	// diameter1 is outer diameter, diameter2 is inner diameter, height1 is Length.
	// measureG is the thread shown in the inner-diameter column (`G 3/4`, `1 1/2"-16 UN`).
	const externalDiameter = positive(item.diameter1);
	const internalDiameter = positive(item.diameter2);
	const height = positive(item.height1);
	const threadSize = text(item.measureG);
	if (
		externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		height !== undefined ||
		threadSize
	) {
		product.dimensions = {};
		if (externalDiameter !== undefined) product.dimensions.externalDiameter = externalDiameter;
		if (internalDiameter !== undefined) product.dimensions.internalDiameter = internalDiameter;
		if (height !== undefined) product.dimensions.height = height;
		if (threadSize) product.dimensions.threadSize = threadSize;
	}

	const material = mediaType(item.beta);
	if (material) product.specs = { mediaType: material };
	return product;
}

function applyDetails(product: Product, details: FiltrecDetailsSchema): void {
	const data = details.data;
	const item = data?.product;
	if (!item) return;

	// English catalog shows noteEng under Note.
	const description =
		text(item.noteEng) ?? text(item.note) ?? text(data.note) ?? text(data.description);
	if (description) product.description = description;

	const material = mediaType(item.beta) ?? product.specs?.mediaType;
	const efficiency = efficiencyText(item.beta);
	// The datasheet shows flow only when `a` is false. Spin-on rows hide it.
	const flowDirection = item.a === false ? text(item.flow) : undefined;
	if (material || efficiency || flowDirection) {
		product.specs = { ...product.specs };
		if (material) product.specs.mediaType = material;
		if (efficiency) product.specs.efficiency = efficiency;
		if (flowDirection) product.specs.flowDirection = flowDirection;
	}

	const externalDiameter = positive(item.diameter1);
	const internalDiameter = positive(item.diameter2);
	const height = positive(item.height1);
	const threadSize = text(item.measureG);
	if (
		externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		height !== undefined ||
		threadSize
	) {
		product.dimensions = { ...product.dimensions };
		if (externalDiameter !== undefined && product.dimensions.externalDiameter === undefined) {
			product.dimensions.externalDiameter = externalDiameter;
		}
		if (internalDiameter !== undefined && product.dimensions.internalDiameter === undefined) {
			product.dimensions.internalDiameter = internalDiameter;
		}
		if (height !== undefined && product.dimensions.height === undefined) {
			product.dimensions.height = height;
		}
		if (threadSize && !product.dimensions.threadSize) product.dimensions.threadSize = threadSize;
	}

	const thumbs = [...(product.thumbnails ?? [])];
	const image = catalogHttpsUrl(item.image?.url);
	const drawing = catalogHttpsUrl(item.drawing?.url);
	if (image && !thumbs.includes(image)) thumbs.unshift(image);
	if (drawing && !thumbs.includes(drawing)) thumbs.push(drawing);
	if (thumbs.length > 0) product.thumbnails = thumbs;
}

async function addDetails(productsByCode: Map<string, Product[]>): Promise<void> {
	if (productsByCode.size === 0) return;
	const pending = productsByCode[Symbol.iterator]();

	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [code, products] = next.value;
			try {
				const response = await axios.request<FiltrecDetailsSchema>({
					method: 'GET',
					url: `${CATALOG_ORIGIN}/api/cross-reference/${code}`,
					params: { locale: LOCALE },
					headers: catalogHeaders
				});
				if (response.status >= 400 || !response.data?.data) continue;
				for (const product of products) applyDetails(product, response.data);
			} catch (error) {
				console.error('filtrec details', code, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, productsByCode.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const productsByCode = new Map<string, Product[]>();
	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'filtrec',
			{
				method: 'GET',
				url: SEARCH_URL,
				params: {
					code,
					page,
					locale: LOCALE
				},
				headers: catalogHeaders
			},
			{
				rowsIterator: (responseData) => {
					const products: Product[] = [];
					const rows = responseData.data ?? [];
					for (const row of rows) {
						const product = toProduct(row);
						products.push(product);
						const path = text(row.productCode);
						if (!path) continue;
						const key = codePath(path);
						const list = productsByCode.get(key);
						if (list) list.push(product);
						else productsByCode.set(key, [product]);
					}
					return products;
				},
				nPages: (responseData) => responseData.meta.pageCount,
				pagination: (responseData) => responseData.meta.numItemsPerPage,
				totalItems: (responseData) => responseData.meta.totalCount
			},
			config,
			page
		);
		if (productsData.meta.status < 400) await addDetails(productsByCode);
		return productsData;
	} catch (error) {
		console.error('filtrec error', error);
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

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page) =>
	await getProducts(code, maxItems, config, page + 1);
