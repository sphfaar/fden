import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config, page: number = 1) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.mann-filter.com/api/graphql/catalog-prod',
		params: {
			query:
				'fragment Brand on SmartSearchBrand{brandName:brand_name vehicleBrandId:vehicle_brand_id modelSeries:model_series{modelSeriesId:model_series_id modelSeriesName:model_series_name modelSeriesDate:model_series_date modelTypes:model_types{bhp ccm engineCode:engine_code fuelType:fuel_type kw modelTypeId:model_type_id vehicleManufacturedFrom:vehicle_manufactured_from vehicleManufacturedTo:vehicle_manufactured_to vehicleName:vehicle_name modelCode:model_code serialNumberRange:serial_number_range __typename}__typename}__typename}query($search:String!$currentPage:Int!$pageSize:Int!$applicationSegmentId:String$applicationCategoryId:Int){catalogSearch:smart_search(search:$search pageSize:$pageSize currentPage:$currentPage applicationSegmentId:$applicationSegmentId applicationCategoryId:$applicationCategoryId){applications{applicationSegment:application_segment totalCount:model_types_total_count brands{...Brand __typename}vehicleCategories:vehicle_categories{vehicleBrandCategory:vehicle_category_name brands{...Brand __typename}__typename}__typename}crossReference:cross_reference{items{product{name sku urlKey:url_key attributes:attributes_value{adminValue:admin_value key value label __typename}customTables:custom_tables{code unit values{adminValue:admin_value key label value unit __typename}__typename}__typename}externalNumber:external_number intProductIdentifier:int_product_identifier externalProductName:ext_product_name manufacturer:ext_brand_name filterBy:aa_product_family textLinkages:linkages{module_name module_unit module_value __typename}__typename}pageInfo:page_info{currentPage:current_page pageSize:page_size totalPages:total_pages __typename}totalCount:total_count __typename}products{items{product{sku urlKey:url_key name attributes:attributes_value{key value adminValue:admin_value __typename}references{referenceTypeId:reference_type_id referenceTypeName:reference_type_name referenceTypeDescription:reference_type_description referenceProducts:reference_products{salesDesignation:sales_designation urlKey:url_key __typename}__typename}__typename}__typename}pageInfo:page_info{pageSize:page_size currentPage:current_page totalPages:total_pages __typename}totalCount:total_count __typename}__typename}}',
			variables: `{"search":"${code}","currentPage":${page},"pageSize":15,"applicationSegmentId":""}`
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			Priority: 'u=4',
			'Cache-Control': 'no-cache',
			'Content-Type': 'application/json'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'mann',
			axiosReqConfig,
			{
				rowsIterator: (responseData) => {
					const products: Product[] = [];
					for (let i = 0; i < responseData.data.catalogSearch.crossReference.items.length; i++) {
						const row = responseData.data.catalogSearch.crossReference.items[i];
						products.push({
							manufacturer: row.manufacturer ?? '',
							manufacturer_code: row.externalProductName ?? '',
							source_reference_code: row?.product?.name ?? '🤔 no equivalent',
							detailsUrl: row?.product?.urlKey
								? `https://www.mann-filter.com/uk-en/catalogue/search-results/product.html/${row?.product?.urlKey}.html`
								: undefined
						});
					}
					return products;
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
		// const response = await axios.request(axiosReqConfig);
		// if (response.status >= 400) {
		// 	return {
		// 		meta: {
		// 			status: response.status,
		// 			currentItemsDisplayed: 0,
		// 			totalItems: 0,
		// 			maxItemsPagination: 0,
		// 			page: 0
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const responseData: ResponseSchema = await response.data;
		// const products: Product[] = [];
		//
		// for (let i = 0; i < responseData.data.catalogSearch.crossReference.items.length; i++) {
		// 	const row = responseData.data.catalogSearch.crossReference.items[i];
		// 	products.push({
		// 		manufacturer: row.manufacturer ?? '',
		// 		manufacturer_code: row.externalProductName ?? '',
		// 		source_reference_code: row?.product?.name ?? '🤔 no equivalent',
		// 		detailsUrl: row?.product?.urlKey
		// 			? `https://www.mann-filter.com/uk-en/catalogue/search-results/product.html/${row?.product?.urlKey}.html`
		// 			: undefined
		// 	});
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: responseData.data.catalogSearch.crossReference.totalCount,
		// 		maxItemsPagination: responseData.data.catalogSearch.crossReference.pageInfo.pageSize,
		// 		page: responseData.data.catalogSearch.crossReference.pageInfo.currentPage
		// 	},
		// 	products: products
		// };
	} catch (err) {
		console.error('MANN error', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				maxItemsPagination: null,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = async (code: string, config, page: number) =>
	await getProducts(code, config, page + 1);
