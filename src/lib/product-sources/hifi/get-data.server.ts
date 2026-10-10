import type ResponseSchema from './response-schema';
import type { HiFiAttribute, HiFiCrossProduct, HiFiMedia, HiFiResult } from './response-schema';
import type { GetNextProducts, GetProducts } from '../types';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const CATALOG_ORIGIN = 'https://catalog.hifi-filter.com';
const PHOTO_URL = 'https://data.hifi-filter.com/media/product/photo/md-';
const MEDIA = 'MEDIA';
const EFFICIENCY = 'MI';
const FLOW = 'FLUX';
const THREADS = ['D7', 'D8'] as const;

// en-GB catalog names for product.family (assets/i18n/en-GB.json). Unknown codes stay as returned.
const FAMILY_LABELS: Record<string, string> = {
	A_AIR: 'Accessory - air',
	A_FUEL: 'Accessory - fuel',
	A_GAS: 'Accessory - gas',
	A_GAS_LIQUID: 'Accessory - gas/liquid',
	A_LIQUID: 'Accessory - liquid',
	A_OIL: 'Accessory - oil',
	A_OTHER: 'Accessory - other',
	A_UREA: 'Accessory - urea',
	F_AIR: 'Filter - air',
	F_FUEL: 'Filter - fuel',
	F_GAS: 'Filter - gas',
	F_GAS_LIQUID: 'Filter - gas/liquid',
	F_LIQUID: 'Filter - liquid',
	F_OIL: 'Filter - oil',
	F_OTHER: 'Filter - other',
	F_UREA: 'Filter - urea',
	K_AIR: 'Kit - air',
	K_FUEL: 'Kit - fuel',
	K_GAS: 'Kit - gas',
	K_GAS_LIQUID: 'Kit - gas/liquid',
	K_LIQUID: 'Kit - liquid',
	K_MULTIPLE: 'Kit - multiple',
	K_OIL: 'Kit - oil',
	K_OTHER: 'Kit - other',
	K_UREA: 'Kit - urea',
	MARKETING: 'Marketing',
	O_KITCOMPONENTS: 'Other - kit components',
	O_MISC: 'Other - miscellaneous',
	O_ROLLS: 'Other - rolls',
	O_SERVICES: 'Other - services'
};

function attributeText(attribute: HiFiAttribute): string | undefined {
	const decimal = attribute.decimalValue;
	// The catalog number pipe treats 0 as empty and falls through to stringValue.
	const text =
		typeof decimal === 'number' && Number.isFinite(decimal) && decimal !== 0
			? String(decimal)
			: attribute.stringValue?.trim() || undefined;
	if (!text) return undefined;
	const unit = attribute.unit?.trim();
	if (unit && !text.endsWith(unit)) return `${text} ${unit}`;
	return text;
}

function valuesFor(attributes: readonly HiFiAttribute[] | undefined, code: string): string[] {
	if (!attributes) return [];
	const values: string[] = [];
	for (const attribute of attributes) {
		if (attribute.code !== code) continue;
		const text = attributeText(attribute);
		if (text) values.push(text);
	}
	return values;
}

function joined(
	attributes: readonly HiFiAttribute[] | undefined,
	code: string
): string | undefined {
	const text = valuesFor(attributes, code).join(', ');
	return text || undefined;
}

function specsFrom(attributes: readonly HiFiAttribute[] | undefined): Product['specs'] | undefined {
	const mediaType = joined(attributes, MEDIA);
	const efficiency = joined(attributes, EFFICIENCY);
	const flowDirection = joined(attributes, FLOW);
	if (!mediaType && !efficiency && !flowDirection) return undefined;
	return { mediaType, efficiency, flowDirection };
}

function dimensionsFrom(
	attributes: readonly HiFiAttribute[] | undefined
): Product['dimensions'] | undefined {
	// D7 is "thread 1" and D8 is "thread 2". D1–D6 and H1–H6 are only "D1 (mm)" / "H1 (mm)".
	const threadSize = THREADS.flatMap((code) => valuesFor(attributes, code)).join(', ');
	if (!threadSize) return undefined;
	return { threadSize };
}

function detailsUrl(item: HiFiCrossProduct): string | undefined {
	if (!item.id || !item.reference) return undefined;
	const slug = item.referenceSlug?.trim()
		? encodeURIComponent(item.referenceSlug.trim())
		: encodeURIComponent(item.reference);
	const id = encodeURIComponent(item.id).replaceAll('%3A', ':');
	return catalogHttpsUrl(`${CATALOG_ORIGIN}/en-GB/product/${slug}/${id}`);
}

function thumbnails(photos: readonly HiFiMedia[] | undefined): string[] | undefined {
	if (!photos || photos.length === 0) return undefined;
	const urls: string[] = [];
	for (const photo of photos) {
		if (!photo.id) continue;
		const url = catalogHttpsUrl(`${PHOTO_URL}${encodeURIComponent(photo.id)}`);
		if (url) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function category(family: string | undefined): string | undefined {
	const code = family?.trim();
	if (!code) return undefined;
	return FAMILY_LABELS[code] ?? code;
}

function toProduct(row: HiFiResult, item: HiFiCrossProduct): Product {
	const product: Product = {
		manufacturer: row.brand.name,
		manufacturer_code: row.reference,
		source_reference_code: item.reference?.trim() || 'No compatible HF reference'
	};
	const url = detailsUrl(item);
	if (url) product.detailsUrl = url;
	const description = item.designation?.trim();
	if (description) product.description = description;
	const family = category(item.family);
	if (family) product.category = family;
	const images = thumbnails(item.photos);
	if (images) product.thumbnails = images;
	const specs = specsFrom(item.attributes);
	if (specs) product.specs = specs;
	const dimensions = dimensionsFrom(item.attributes);
	if (dimensions) product.dimensions = dimensions;
	return product;
}

export const getProducts: GetProducts = (code, maxItems, config, page = 1) => {
	void maxItems;

	const axiosReqConfig = {
		method: 'POST',
		url: 'https://catalog.hifi-filter.com/api/cross-reference/search',
		params: {
			q: code,
			p: page
		},
		headers: {
			...headers,
			'Content-Type': 'application/json',
			Accept: 'application/json',
			'Accept-Language': 'en-US,en;q=0.5',
			'X-Api-Locale': 'en-GB',
			'Content-Length': '2',
			Origin: 'https://catalog.hifi-filter.com',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			TE: 'trailers'
		},
		data: '[]'
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'hifi',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (const row of resData.results) {
						if (row.products.length === 0) {
							products.push({
								manufacturer: row.brand.name,
								manufacturer_code: row.reference,
								source_reference_code: 'No compatible HF reference'
							});
							continue;
						}
						for (const item of row.products) products.push(toProduct(row, item));
					}
					return products;
				},
				nPages: (resData) => resData.paging.lastPage ?? 0,
				pagination: (resData) => resData.paging.pageSize,
				totalItems: (resData) => resData.paging.totalFetched
			},
			config,
			page
		);
	} catch (err) {
		failSourceRequest(err, 'HIFI error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
