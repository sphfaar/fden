import type { GetNextProducts, GetProducts } from '../types';
import type WixSchema from './response-schema';
import type { WixAssetHit, WixAssets } from './response-schema';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';
import axios from '#lib/product-sources/axios.server.js';

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

type WixCrossReferenceItem = WixSchema['data']['catalogSearch']['crossReference']['items'][number];
type WixAttributeList =
	readonly { key: string; value: string | null; label: string | null }[] | null | undefined;

function catalogText(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return trimmed
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

function attributeValue(attributes: WixAttributeList, key: string): string | undefined {
	return catalogText(attributes?.find((attribute) => attribute.key === key)?.value);
}

function labeledValue(attributes: WixAttributeList, key: string): string | undefined {
	const found = attributes?.find((attribute) => attribute.key === key);
	const value = catalogText(found?.value);
	if (!value) return undefined;
	const label = catalogText(found?.label);
	return label ? `${label} ${value}` : value;
}

function millimeters(value: string | undefined): number | undefined {
	return value !== undefined && MILLIMETERS.test(value) ? Number(value) : undefined;
}

function firstMillimeters(
	attributes: WixAttributeList,
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

function categoryOf(row: WixCrossReferenceItem): string | undefined {
	const attributes = row.product?.attributes;
	const family = catalogText(row.filterBy) || attributeValue(attributes, 'aa_product_family');
	const subfamily = attributeValue(attributes, 'aa_product_subfamily');
	if (family && subfamily && subfamily.toLowerCase() !== family.toLowerCase()) {
		return `${family} | ${subfamily}`;
	}
	return family || subfamily;
}

function toProduct(row: WixCrossReferenceItem): Product {
	const attributes = row.product?.attributes;
	const salesDesignation = attributeValue(attributes, 'sales_designation');
	const productName = catalogText(row.product?.name);
	const height = millimeters(attributeValue(attributes, 'height'));
	const externalDiameter = firstMillimeters(attributes, [
		'outer_diameter',
		'outer_diameter_1',
		'outside_diameter_top',
		'outside_diameter_bottom',
		'outer_diameter_2'
	]);
	const internalDiameter = firstMillimeters(attributes, [
		'inner_diameter_1',
		'inside_diameter_top',
		'inside_diameter_bottom',
		'inner_diameter_2'
	]);
	// thread_size is the catalog thread. Inlet and outlet are port diameters in millimeters.
	const threadSize = attributeValue(attributes, 'thread_size');
	const packWidth = millimeters(attributeValue(attributes, 'width'));
	const packLength = millimeters(attributeValue(attributes, 'length'));
	const mediaType = attributeValue(attributes, 'filter_media_material');
	const efficiency = [
		labeledValue(attributes, 'nominal_micron_rating'),
		labeledValue(attributes, 'beta_ratio')
	]
		.filter((value) => value !== undefined)
		.join('; ');
	const fitment = attributeValue(attributes, 'main_application_aa');
	const fact1 = attributeValue(attributes, 'marketing_text_filtertype_cont_key_fact1');
	const fact2 = attributeValue(attributes, 'marketing_text_filtertype_cont_key_fact2');
	const feature = attributeValue(attributes, 'product_feature_1');
	const description = fitment || fact1 || feature;
	const longDescription = joinedText([
		fact1 && fact1 !== description ? fact1 : undefined,
		fact2,
		feature && feature !== description ? feature : undefined
	]);
	const urlKey = row.product?.urlKey?.trim();
	const detailsUrl = catalogHttpsUrl(
		urlKey ? `${CATALOG_ORIGIN}/en-eu/catalog/results/product.html/${urlKey}.html` : undefined
	);
	const dimensions: Product['dimensions'] = {};
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	if (threadSize) dimensions.threadSize = threadSize;
	const specs: Product['specs'] = {};
	if (mediaType) specs.mediaType = mediaType;
	if (efficiency) specs.efficiency = efficiency;
	const hasDimensions =
		externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		height !== undefined ||
		threadSize !== undefined;

	return {
		manufacturer: catalogText(row.manufacturer) ?? '',
		manufacturer_code: catalogText(row.externalProductName) ?? '',
		source_reference_code: salesDesignation || productName || 'no equivalent',
		detailsUrl,
		description,
		longDescription,
		category: categoryOf(row),
		dimensions: hasDimensions ? dimensions : undefined,
		specs: mediaType || efficiency ? specs : undefined,
		packaging:
			packWidth !== undefined && packLength !== undefined && height !== undefined
				? { width: packWidth, length: packLength, height }
				: undefined
	};
}

function assetForSku(hits: readonly WixAssetHit[], sku: string): WixAssetHit | undefined {
	const matches = hits.filter(
		(hit) => Boolean(hit.uriTemplate) && hit.metaData?.productReferences?.includes(sku)
	);
	return matches.find((hit) => !hit.metaData?.erpReferences?.length) ?? matches[0];
}

// Product photos are a second catalog call. The GraphQL body only has a generic shape drawing.
async function addThumbnails(skuByProduct: Map<Product, string>): Promise<void> {
	const skus = [...new Set(skuByProduct.values())];
	if (skus.length === 0) return;
	try {
		const hits: WixAssetHit[] = [];
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
			const response = await axios.request<WixAssets>({
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
		console.error('WIX thumbnails', error);
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
		const productsData = await getJsonToProducts<WixSchema>(
			'wix',
			axiosReqConfig,
			{
				rowsIterator: (responseData) =>
					responseData.data.catalogSearch.crossReference.items.map((row) => {
						const product = toProduct(row);
						const sku = row.product?.sku?.trim();
						if (sku) skuByProduct.set(product, sku);
						return product;
					}),
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
		failSourceRequest(err, 'WIX error');
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page: number) =>
	getProducts(code, maxItems, config, page + 1);
