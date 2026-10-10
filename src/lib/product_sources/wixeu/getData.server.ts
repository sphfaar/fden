import type { GetNextProducts, GetProducts } from '../types';
import type WixEuSchema from './ResponseSchema';
import type { WixEuAssetHit, WixEuAssets } from './ResponseSchema';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import { getJsonToProducts } from '#lib/product_sources/getJsonToProductsData.server.js';
import { headers } from '#lib/product_sources/constants.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';
import axios from '#lib/product_sources/axios.server.js';

const CATALOG_ORIGIN = 'https://www.wixfilters.com';
const MILLIMETERS = /^\d+(\.\d+)?$/;
const THUMBNAIL_WIDTH = '400';
const ASSET_LIMIT = 100;
const ASSET_BATCH = 20;

const query = `query ($search: String!, $currentPage: Int!, $pageSize: Int!) {
	catalogSearch: smart_search(search: $search, pageSize: $pageSize, currentPage: $currentPage) {
		crossReference: cross_reference {
			items {
				product {
					name
					sku
					urlKey: url_key
					attributes: attributes_value { key value label }
				}
				externalProductName: ext_product_name
				manufacturer: ext_brand_name
				filterBy: aa_product_family
			}
			pageInfo: page_info {
				currentPage: current_page
				pageSize: page_size
				totalPages: total_pages
			}
			totalCount: total_count
		}
	}
}`;

type WixEuCrossReferenceItem =
	WixEuSchema['data']['catalogSearch']['crossReference']['items'][number];
type WixEuAttributeList =
	readonly { key: string; value: string | null; label: string | null }[] | null | undefined;

function attributeValue(attributes: WixEuAttributeList, key: string): string | undefined {
	const value = attributes?.find((attribute) => attribute.key === key)?.value?.trim();
	return value || undefined;
}

function labeledValue(attributes: WixEuAttributeList, key: string): string | undefined {
	const found = attributes?.find((attribute) => attribute.key === key);
	const value = found?.value?.trim();
	if (!value) return undefined;
	const label = found?.label?.trim();
	return label ? `${label} ${value}` : value;
}

function millimeters(value: string | undefined): number | undefined {
	return value !== undefined && MILLIMETERS.test(value) ? Number(value) : undefined;
}

function firstMillimeters(
	attributes: WixEuAttributeList,
	keys: readonly string[]
): number | undefined {
	for (const key of keys) {
		const parsed = millimeters(attributeValue(attributes, key));
		if (parsed !== undefined) return parsed;
	}
	return undefined;
}

function joinedText(values: readonly (string | undefined)[]): string | undefined {
	const text = values.filter((value) => value !== undefined).join('\n');
	return text || undefined;
}

function categoryOf(row: WixEuCrossReferenceItem): string | undefined {
	const attributes = row.product?.attributes;
	const family = row.filterBy?.trim() || attributeValue(attributes, 'aa_product_family');
	const subfamily = attributeValue(attributes, 'aa_product_subfamily');
	return family && subfamily && subfamily.toLowerCase() !== family.toLowerCase()
		? `${family} | ${subfamily}`
		: family || subfamily;
}

function toProduct(row: WixEuCrossReferenceItem): Product {
	const attributes = row.product?.attributes;
	const salesDesignation = attributeValue(attributes, 'sales_designation');
	const productName = row.product?.name?.trim();
	const height = millimeters(attributeValue(attributes, 'height'));
	const externalDiameter = firstMillimeters(attributes, [
		'outer_diameter',
		'outer_diameter_1',
		'outside_diameter_top',
		'outside_diameter_bottom'
	]);
	const internalDiameter = firstMillimeters(attributes, [
		'inner_diameter_1',
		'inside_diameter_top',
		'inside_diameter_bottom',
		'inner_diameter_2'
	]);
	const mediaType = attributeValue(attributes, 'filter_media_material');
	const efficiency = [
		labeledValue(attributes, 'nominal_micron_rating'),
		labeledValue(attributes, 'beta_ratio')
	]
		.filter((value) => value !== undefined)
		.join('; ');
	const fitment = attributeValue(attributes, 'main_application_aa');
	const description = attributeValue(attributes, 'marketing_text_filtertype_cont_key_fact1');
	const longDescription = joinedText([
		attributeValue(attributes, 'marketing_text_filtertype_cont_key_fact2'),
		fitment ? `Main application: ${fitment}` : undefined
	]);
	const urlKey = row.product?.urlKey?.trim();
	const detailsUrl = catalogHttpsUrl(
		urlKey ? `${CATALOG_ORIGIN}/en-eu/catalog/results/product.html/${urlKey}.html` : undefined
	);
	const dimensions: Product['dimensions'] = {};
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	const specs: Product['specs'] = {};
	if (mediaType) specs.mediaType = mediaType;
	if (efficiency) specs.efficiency = efficiency;

	return {
		manufacturer: row.manufacturer?.trim() ?? '',
		manufacturer_code: row.externalProductName?.trim() ?? '',
		source_reference_code: salesDesignation || productName || 'no equivalent',
		detailsUrl,
		description,
		longDescription,
		category: categoryOf(row),
		dimensions:
			externalDiameter !== undefined || internalDiameter !== undefined || height !== undefined
				? dimensions
				: undefined,
		specs: mediaType || efficiency ? specs : undefined
	};
}

function assetForSku(hits: readonly WixEuAssetHit[], sku: string): WixEuAssetHit | undefined {
	const matches = hits.filter((hit) => hit.metaData?.productReferences?.includes(sku));
	return matches.find((hit) => !hit.metaData?.erpReferences?.length) ?? matches[0];
}

// Product photos are a second catalog call. GraphQL image fields are Magento placeholders.
async function addThumbnails(skuByProduct: Map<Product, string>): Promise<void> {
	const skus = [...new Set(skuByProduct.values())];
	if (skus.length === 0) return;
	try {
		const hits: WixEuAssetHit[] = [];
		for (let start = 0; start < skus.length; start += ASSET_BATCH) {
			const batch = skus.slice(start, start + ASSET_BATCH);
			const searchParameters = new URLSearchParams({
				metaData: 'true',
				brand: 'WIX Filters',
				productView: 'Front',
				productRelatedAssetType: 'Product Image',
				mainImage: 'true',
				limit: String(ASSET_LIMIT)
			});
			for (const sku of batch) searchParameters.append('productReferences', sku);
			const response = await axios.request<WixEuAssets>({
				method: 'GET',
				url: `${CATALOG_ORIGIN}/bin/assets.json?${searchParameters.toString()}`,
				headers: {
					...headers,
					Accept: 'application/json'
				}
			});
			if (response.data.successful === false) continue;
			hits.push(...(response.data.hits ?? []));
		}
		for (const [product, sku] of skuByProduct) {
			const template = assetForSku(hits, sku)?.uriTemplate?.split('{width}').join(THUMBNAIL_WIDTH);
			const thumbnail = catalogHttpsUrl(template);
			if (thumbnail) product.thumbnails = [thumbnail];
		}
	} catch (error) {
		console.error('WIX EU thumbnails', error);
	}
}

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const pageSize = Math.min(maxItems, 100);
	const axiosReqConfig = {
		method: 'GET',
		url: `${CATALOG_ORIGIN}/api/graphql/catalog-prod`,
		params: {
			query,
			variables: JSON.stringify({
				search: code,
				currentPage: page,
				pageSize
			})
		},
		headers: {
			...headers,
			Accept: 'application/json',
			// en-eu catalog store view. The public page sends this Store header.
			Store: 'pcat_wix_gb_store_en'
		}
	};
	const skuByProduct = new Map<Product, string>();
	try {
		const productsData = await getJsonToProducts<WixEuSchema>(
			'wixeu',
			axiosReqConfig,
			{
				rowsIterator: (responseData) => {
					const items = responseData.data?.catalogSearch?.crossReference?.items;
					if (!items) throw new Error('WIX EU catalog response has no cross-reference items');
					return items.map((row) => {
						const product = toProduct(row);
						const sku = row.product?.sku?.trim();
						if (sku) skuByProduct.set(product, sku);
						return product;
					});
				},
				nPages: (responseData) =>
					responseData.data.catalogSearch.crossReference.pageInfo.totalPages,
				pagination: (responseData) =>
					responseData.data.catalogSearch.crossReference.pageInfo.pageSize,
				totalItems: (responseData) => responseData.data.catalogSearch.crossReference.totalCount
			},
			config,
			page
		);
		await addThumbnails(skuByProduct);
		return productsData;
	} catch (err) {
		failSourceRequest(err, 'WIX-EU error');
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page: number) =>
	getProducts(code, maxItems, config, page + 1);
