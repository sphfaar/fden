import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import axios from '#lib/product-sources/axios.server.js';
import { getJsonToProducts } from '#lib/product-sources/get-json-to-products-data.server.js';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const CATALOG_ORIGIN = 'https://www.mann-filter.com';
const SEARCH_URL = `${CATALOG_ORIGIN}/api/graphql/catalog-prod`;
const ASSETS_URL = `${CATALOG_ORIGIN}/bin/assets.json`;
const DETAILS_PREFIX = `${CATALOG_ORIGIN}/uk-en/catalogue/search-results/product.html/`;

const SEARCH_QUERY = 'fragment Brand on SmartSearchBrand{brandName:brand_name vehicleBrandId:vehicle_brand_id modelSeries:model_series{modelSeriesId:model_series_id modelSeriesName:model_series_name modelSeriesDate:model_series_date modelTypes:model_types{bhp ccm engineCode:engine_code fuelType:fuel_type kw modelTypeId:model_type_id vehicleManufacturedFrom:vehicle_manufactured_from vehicleManufacturedTo:vehicle_manufactured_to vehicleName:vehicle_name modelCode:model_code serialNumberRange:serial_number_range __typename}__typename}__typename}query($search:String!$currentPage:Int!$pageSize:Int!$applicationSegmentId:String$applicationCategoryId:Int){catalogSearch:smart_search(search:$search pageSize:$pageSize currentPage:$currentPage applicationSegmentId:$applicationSegmentId applicationCategoryId:$applicationCategoryId){applications{applicationSegment:application_segment totalCount:model_types_total_count brands{...Brand __typename}vehicleCategories:vehicle_categories{vehicleBrandCategory:vehicle_category_name brands{...Brand __typename}__typename}__typename}crossReference:cross_reference{items{product{name sku urlKey:url_key attributes:attributes_value{adminValue:admin_value key value label __typename}customTables:custom_tables{code unit values{adminValue:admin_value key label value unit __typename}__typename}__typename}externalNumber:external_number intProductIdentifier:int_product_identifier externalProductName:ext_product_name manufacturer:ext_brand_name filterBy:aa_product_family textLinkages:linkages{module_name module_unit module_value __typename}__typename}pageInfo:page_info{currentPage:current_page pageSize:page_size totalPages:total_pages __typename}totalCount:total_count __typename}products{items{product{sku urlKey:url_key name attributes:attributes_value{key value adminValue:admin_value __typename}references{referenceTypeId:reference_type_id referenceTypeName:reference_type_name referenceTypeDescription:reference_type_description referenceProducts:reference_products{salesDesignation:sales_designation urlKey:url_key __typename}__typename}__typename}__typename}pageInfo:page_info{pageSize:page_size currentPage:current_page totalPages:total_pages __typename}totalCount:total_count __typename}__typename}}';

type MannRow = ResponseSchema['data']['catalogSearch']['crossReference']['items'][number];

interface MannAssetHit {
	uriTemplate?: string;
	metaData?: {
		productReferences?: string[];
	};
}

interface MannAssets {
	hits?: MannAssetHit[];
	hasMore?: boolean;
}

const MILLIMETER_LABELS: Record<string, keyof NonNullable<Product['dimensions']>> = {
	'outer diameter': 'externalDiameter',
	'inner diameter': 'internalDiameter',
	height: 'height',
	'inner diameter of gasket': 'gasketInternalDiameter',
	'outer diameter of gasket': 'gasketExternalDiameter',
	'thread size': 'threadSize'
};

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function millimeters(value: string | undefined): number | undefined {
	if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function attributesOf(row: MannRow): Map<string, string> {
	const map = new Map<string, string>();
	for (const attribute of row.product?.attributes ?? []) {
		const value = text(attribute.value);
		if (attribute.key && value) map.set(attribute.key, value);
	}
	return map;
}

function fillNamedDimensions(
	dimensions: NonNullable<Product['dimensions']>,
	attrs: Map<string, string>
) {
	const externalDiameter = millimeters(attrs.get('outer_diameter'));
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	const internalDiameter = millimeters(attrs.get('inner_diameter'));
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	const height = millimeters(attrs.get('height'));
	if (height !== undefined) dimensions.height = height;
	const gasketExternalDiameter = millimeters(attrs.get('outer_diameter_of_gasket'));
	if (gasketExternalDiameter !== undefined) dimensions.gasketExternalDiameter = gasketExternalDiameter;
	const gasketInternalDiameter = millimeters(attrs.get('inner_diameter_of_gasket'));
	if (gasketInternalDiameter !== undefined) dimensions.gasketInternalDiameter = gasketInternalDiameter;
	const threadSize = attrs.get('thread_size');
	if (threadSize) dimensions.threadSize = threadSize;
}

// dimension_table letters change meaning by shape. Fill only labels the dimension string names.
function fillDimensionString(
	dimensions: NonNullable<Product['dimensions']>,
	raw: string | undefined
) {
	if (!raw) return;
	for (const part of raw.split(';')) {
		const match = part.trim().match(/^(.+?)\s*\([A-Z]\)\s*=\s*(.+)$/i);
		if (!match) continue;
		const field = MILLIMETER_LABELS[match[1].trim().toLowerCase()];
		if (!field || dimensions[field] !== undefined) continue;
		const value = match[2].trim();
		if (field === 'threadSize') {
			if (value) dimensions.threadSize = value;
			continue;
		}
		const mm = value.match(/^(\d+(?:[.,]\d+)?)\s*mm$/i);
		if (!mm) continue;
		const parsed = millimeters(mm[1].replace(',', '.'));
		if (parsed !== undefined) dimensions[field] = parsed;
	}
}

function dimensionsFrom(attrs: Map<string, string>): Product['dimensions'] {
	const dimensions: NonNullable<Product['dimensions']> = {};
	fillNamedDimensions(dimensions, attrs);
	fillDimensionString(dimensions, attrs.get('aa_dimension_string'));
	return Object.keys(dimensions).length ? dimensions : undefined;
}

function toProduct(row: MannRow): Product {
	const attrs = attributesOf(row);
	const product: Product = {
		manufacturer: text(row.manufacturer) ?? '',
		manufacturer_code: text(row.externalProductName) ?? '',
		source_reference_code:
			attrs.get('sales_designation') ?? text(row.product?.name) ?? 'no equivalent'
	};
	const category = text(row.filterBy);
	if (category) product.category = category;
	const fact1 = attrs.get('marketing_text_filtertype_cont_key_fact1');
	const fact2 = attrs.get('marketing_text_filtertype_cont_key_fact2');
	if (fact1) product.description = fact1;
	else if (fact2) product.description = fact2;
	if (fact1 && fact2) {
		const separator = /[.!?]$/.test(fact1) ? ' ' : '. ';
		product.longDescription = `${fact1}${separator}${fact2}`;
	}
	const dimensions = dimensionsFrom(attrs);
	if (dimensions) product.dimensions = dimensions;
	const urlKey = text(row.product?.urlKey);
	if (urlKey) {
		const detailsUrl = catalogHttpsUrl(`${DETAILS_PREFIX}${urlKey}.html`);
		if (detailsUrl) product.detailsUrl = detailsUrl;
	}
	return product;
}

function assetUrl(template: string | undefined): string | undefined {
	if (!template) return undefined;
	return catalogHttpsUrl(template.split('{width}').join('1000'));
}

async function thumbnailsBySku(skus: string[]): Promise<Map<string, string[]>> {
	const unique = [...new Set(skus.filter((sku) => sku))];
	const bySku = new Map<string, string[]>();
	if (unique.length === 0) return bySku;
	const limit = Math.min(100, unique.length);
	let offset = 0;
	for (let attempt = 0; attempt < 3; attempt++) {
		const params = new URLSearchParams({
			metaData: 'true',
			brand: 'MANN-FILTER',
			productView: 'Front',
			productDimensionAsset: 'No',
			productRelatedAssetType: 'Product Image',
			mainImage: 'true',
			limit: String(limit),
			offset: String(offset)
		});
		for (const sku of unique) params.append('productReferences', sku);
		const response = await axios.get<MannAssets>(`${ASSETS_URL}?${params.toString()}`, {
			headers: {
				...headers,
				Accept: 'application/json'
			}
		});
		if (response.status >= 400) break;
		for (const hit of response.data?.hits ?? []) {
			const url = assetUrl(hit.uriTemplate);
			if (!url) continue;
			for (const sku of hit.metaData?.productReferences ?? []) {
				const id = text(sku);
				if (!id) continue;
				const urls = bySku.get(id) ?? [];
				if (!urls.includes(url)) urls.push(url);
				bySku.set(id, urls);
			}
		}
		if (!response.data?.hasMore) break;
		offset += limit;
	}
	return bySku;
}

async function addThumbnails(
	products: Product[],
	skus: string[],
	config: Parameters<GetProducts>[2],
	meta: Metadata
) {
	const started = config?.showPerfReqProxyToSource ? Date.now() : undefined;
	try {
		const bySku = await thumbnailsBySku(skus);
		products.forEach((product, index) => {
			const urls = bySku.get(skus[index] ?? '');
			if (urls?.length) product.thumbnails = urls;
		});
	} catch (err) {
		console.error('MANN assets', err);
	}
	if (started !== undefined) {
		const previous = meta.performanceTimings?.proxyToSource ?? 0;
		meta.performanceTimings = { proxyToSource: previous + (Date.now() - started) };
	}
}

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const nItems = Math.min(maxItems, 100);
	const skus: string[] = [];

	const axiosReqConfig = {
		method: 'GET',
		url: SEARCH_URL,
		params: {
			query: SEARCH_QUERY,
			variables: JSON.stringify({
				search: code,
				currentPage: page,
				pageSize: nItems,
				applicationSegmentId: ''
			})
		},
		headers: {
			...headers,
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			Priority: 'u=4',
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/json'
		}
	};
	try {
		const productsData = await getJsonToProducts<ResponseSchema>(
			'mann',
			axiosReqConfig,
			{
				rowsIterator: (responseData) => {
					skus.length = 0;
					return responseData.data.catalogSearch.crossReference.items.map((row) => {
						skus.push(text(row.product?.sku) ?? '');
						return toProduct(row);
					});
				},
				nPages: (resData) =>
					Math.ceil(
						resData.data.catalogSearch.crossReference.totalCount /
							resData.data.catalogSearch.crossReference.pageInfo.pageSize
					),
				pagination: (resData) => resData.data.catalogSearch.crossReference.pageInfo.pageSize,
				totalItems: (resData) => resData.data.catalogSearch.crossReference.totalCount
			},
			config,
			page
		);
		if (productsData.meta.status < 400 && productsData.products.length > 0)
			await addThumbnails(productsData.products, skus, config, productsData.meta);
		return productsData;
	} catch (err) {
		console.error('MANN error', err);
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

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page: number) =>
	await getProducts(code, maxItems, config, page + 1);
