import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const nItems = Math.min(maxItems, 100);

	const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: `https://crossref.search.windows.net/indexes/partcrossreference-prod-search-view-index/docs?api-version=2019-05-06&facet=FromManufacturerName,count%3A1000&facet=Type,count%3A1000&facet=DivisionName,count%3A1000&search=${codeEncoded}%20and%20CleanedFromPartNumber%3A%2F(.*)${codeEncoded}(.*)%2F&%24filter=(DivisionName%20ne%20'Total%20Filtration%20Services')%20and%20Published%20eq%20'YES'&%24top=${nItems}&queryType=full&%24count=true`,
		headers: {
			...headers,
			'api-key': 'C57B3E22FF9AD549129AB375C6F2F93A'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'parker',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const responseFilterRgx = /possible alternatives|no CRossover/i;
					const products: Product[] = [];
					for (let i = 0; i < resData.value.length; i++) {
						const row = resData.value[i];
						if (!responseFilterRgx.test(row.ToPartNumber)) {
							products.push({
								manufacturer: row.FromManufacturerName,
								manufacturer_code: row.FromPartNumber,
								source_reference_code: row.ToPartNumber
							});
						}
					}
					return products;
				},
				totalItems: (resData) => resData.value.length
			},
			config
		);
	} catch (err) {
		console.error('Parker error', err);
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

export const getNextProducts: GetNextProducts = () => null;
