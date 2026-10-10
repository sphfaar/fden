import type { GetNextProducts, GetProducts } from '../types';
import type ArgohytosSchema from './ResponseSchema';
import type {
	ArgohytosAttribute,
	ArgohytosCategory,
	ArgohytosDetails,
	ArgohytosRow
} from './ResponseSchema';
import axios from '#lib/product_sources/axios.server.js';
import { headers } from '#lib/product_sources/constants.js';
import { getJsonToProducts } from '#lib/product_sources/getJsonToProductsData.server.js';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';

const CATALOG_ORIGIN = 'https://portal.argo-hytos.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/core-app/api/elastic-search/oem-spare-parts`;
const DETAILS_URL = `${CATALOG_ORIGIN}/core-app/api/catalog/product-details`;
const PAGE_CAP = 24;
const DETAIL_CONCURRENCY = 8;
const ROOT_CATEGORY = 'ai_argo_hytos_products';
const LENGTH = 'BAA018001_length';
const EXTERNAL_DIAMETER = 'BAB376001_external_diameter';
const INNER_DIAMETER = 'BAA563001_inner_diameter';
const FINENESS = 'VDV000023_ah_filter_fineness';
const MEDIA = 'VDV000030_ah_filtration_material';
const MICRONS = /(?:µm|μm)/u;

const catalogHeaders = {
	...headers,
	Accept: 'application/json, text/plain, */*',
	'Accept-Language': 'en-US,en;q=0.5',
	Origin: CATALOG_ORIGIN,
	Referer: `${CATALOG_ORIGIN}/`
};

// The shop drops "." before search. Elastic treats "R3.0812" and "R30812" as different terms.
function searchTerm(code: string): string {
	return code.replaceAll('.', '');
}

function attributeValue(
	attributes: readonly ArgohytosAttribute[] | undefined,
	code: string
): string | undefined {
	const value = attributes?.find((attribute) => attribute.code === code)?.value?.trim();
	return value || undefined;
}

function millimeters(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = /^(\d+(?:[.,]\d+)?)\s*mm$/i.exec(value.trim());
	if (!match) return undefined;
	const parsed = Number(match[1].replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : undefined;
}

function thumbnails(imagePath: string | null | undefined): string[] | undefined {
	if (!imagePath) return undefined;
	const urls: string[] = [];
	for (const part of imagePath.split(',')) {
		const url = catalogHttpsUrl(part);
		if (url) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

// Catalog routes are /catalog/{root}/search/{leaf}/product-details/{sku}.
// categories[0] is the leaf. A bare /product-details/{sku} is the same page.
function detailsUrl(sku: string, categories?: readonly ArgohytosCategory[]): string | undefined {
	const id = encodeURIComponent(sku);
	if (!categories || categories.length === 0) {
		return catalogHttpsUrl(`${CATALOG_ORIGIN}/product-details/${id}`);
	}
	const [leaf, ...parents] = categories;
	const codes = [leaf, { code: 'search' }, ...parents]
		.toReversed()
		.map((category) => encodeURIComponent(category.code));
	return catalogHttpsUrl(`${CATALOG_ORIGIN}/catalog/${codes.join('/')}/product-details/${id}`);
}

function toProduct(row: ArgohytosRow): Product {
	const product: Product = {
		manufacturer: row.referenceName,
		manufacturer_code: row.referenceNumber,
		source_reference_code: row.materialNumber
	};
	const url = detailsUrl(row.sku || row.id);
	if (url) product.detailsUrl = url;
	const description = row.description?.trim();
	if (description) product.description = description;
	const images = thumbnails(row.imagePath);
	if (images) product.thumbnails = images;
	// `dimension` is the headline characteristic: fineness ("10 µm") or a flow ("105 l/min").
	const dimension = row.dimension?.trim();
	if (dimension && MICRONS.test(dimension)) product.specs = { efficiency: dimension };
	return product;
}

function applyDetails(product: Product, details: ArgohytosDetails): void {
	const category = details.categories?.find((item) => item.code !== ROOT_CATEGORY)?.label?.trim();
	if (category) product.category = category;

	const url = detailsUrl(details.sku, details.categories);
	if (url) product.detailsUrl = url;

	const longDescription = details.productDescription?.trim();
	if (longDescription) product.longDescription = longDescription;

	const name = attributeValue(details.headerAttributes, 'name');
	if (name && !product.description) product.description = name;

	const fineness = attributeValue(details.extendedAttributes, FINENESS);
	const mediaType = attributeValue(details.extendedAttributes, MEDIA);
	const specs: Product['specs'] = { ...product.specs };
	if (mediaType) specs.mediaType = mediaType;
	if (fineness) specs.efficiency = fineness;
	if (specs.mediaType || specs.efficiency) product.specs = specs;

	// The catalog calls the element's axial size Length. Product stores that number as height.
	const externalDiameter = millimeters(
		attributeValue(details.extendedAttributes, EXTERNAL_DIAMETER)
	);
	const internalDiameter = millimeters(attributeValue(details.extendedAttributes, INNER_DIAMETER));
	const height = millimeters(attributeValue(details.extendedAttributes, LENGTH));
	if (externalDiameter !== undefined || internalDiameter !== undefined || height !== undefined) {
		product.dimensions = {};
		if (externalDiameter !== undefined) product.dimensions.externalDiameter = externalDiameter;
		if (internalDiameter !== undefined) product.dimensions.internalDiameter = internalDiameter;
		if (height !== undefined) product.dimensions.height = height;
	}

	if (product.thumbnails) return;
	const images = thumbnails(details.imagePath);
	if (images) product.thumbnails = images;
}

async function addDetails(skuByProduct: Map<Product, string>): Promise<void> {
	if (skuByProduct.size === 0) return;
	const pending = skuByProduct[Symbol.iterator]();

	async function worker(): Promise<void> {
		while (true) {
			const next = pending.next();
			if (next.done) return;
			const [product, sku] = next.value;
			try {
				const response = await axios.request<ArgohytosDetails>({
					method: 'GET',
					url: DETAILS_URL,
					params: { sku },
					headers: catalogHeaders
				});
				if (response.status >= 400) continue;
				applyDetails(product, response.data);
			} catch (error) {
				console.error('argohytos details', sku, error);
			}
		}
	}

	const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, skuByProduct.size) }, () =>
		worker()
	);
	await Promise.all(workers);
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = Math.max(1, Math.min(maxItems, PAGE_CAP));
	const safePage = page > 0 ? page : 1;
	const offset = pageSize * (safePage - 1);
	// The portal sends `offset` but the API returns the first `limit` rows anyway.
	// Ask for the rows up to the end of this page, then keep this page's slice.
	const fetchLimit = offset + pageSize;
	const skuByProduct = new Map<Product, string>();

	try {
		const productsData = await getJsonToProducts<ArgohytosSchema>(
			'argohytos',
			{
				method: 'POST',
				url: SEARCH_URL,
				headers: {
					...catalogHeaders,
					'Content-Type': 'application/json'
				},
				data: {
					term: searchTerm(code),
					filters: [],
					language: 'en',
					limit: fetchLimit,
					offset
				}
			},
			{
				rowsIterator: (responseData) => {
					const rows = responseData.data ?? [];
					const pageRows =
						offset > 0 && rows.length > pageSize
							? rows.slice(offset, offset + pageSize)
							: rows.slice(0, pageSize);
					return pageRows.map((row) => {
						const product = toProduct(row);
						const sku = row.sku?.trim() || row.id?.trim();
						if (sku) skuByProduct.set(product, sku);
						return product;
					});
				},
				nPages: (responseData) => Math.ceil(responseData.count / pageSize),
				pagination: pageSize,
				totalItems: (responseData) => responseData.count
			},
			config,
			safePage
		);
		if (productsData.meta.status < 400) await addDetails(skuByProduct);
		return productsData;
	} catch (error) {
		failSourceRequest(error, 'argohytos error');
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
