import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.hydac.com/it-it/tool-online/betterfit/betterfitSearch',
		params: {
			query: code
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
			DNT: '1'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'hydac',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.relation.length; i++) {
						const row = resData.relation[i];
						products.push({
							manufacturer: row.competitor.manufacturer.title,
							manufacturer_code: row.competitor.title,
							source_reference_code: row.hydac.title
						});
					}
					return products;
				}
			},
			config
		);
		// const response = await fetch(
		// 	`https://www.hydac.com/it-it/tool-online/betterfit/betterfitSearch/?query=${codeEncoded}`,
		// 	{
		// 		method: 'GET',
		// 		headers: {
		// 			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
		// 			DNT: '1'
		// 		}
		// 	}
		// );
		//
		// if (!response.ok) {
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
		// const responseData: ResponseSchema = await response.json();
		// const products: Product[] = [];
		//
		// for (let i = 0; i < responseData.relation.length; i++) {
		// 	const row = responseData.relation[i];
		// 	products.push({
		// 		manufacturer: row.competitor.manufacturer.title,
		// 		manufacturer_code: row.competitor.title,
		// 		source_reference_code: row.hydac.title
		// 	});
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: responseData.resultCount,
		// 		totalItems: responseData.resultCount,
		// 		maxItemsPagination: null,
		// 		page: 1
		// 	},
		// 	products: products
		// };
	} catch (err) {
		console.error('Hydac error', err);
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

export const getNextProducts: GetNextProducts = () => null;
