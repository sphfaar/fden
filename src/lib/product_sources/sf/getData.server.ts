import type ResponseSchema from './ResponseSchema';
import { error } from '@sveltejs/kit';
// import axios from 'axios';
import type { GetProducts, GetNextProducts } from '../types';
import { getJsonToProducts } from '../getJsonToProductsData.server';

export const getProducts: GetProducts = (code: string, config, page = 1) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.sf-filter.com/api/cross-reference/product-search',
		params: { limit: 40, offset: 0, query: code },
		headers: {
			Host: 'www.sf-filter.com',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			Accept: 'application/json',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			DNT: '1',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			TE: 'trailers',
			'content-type': 'application/json',
			'x-culture': 'en',
			Priority: 'u=6',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'sf',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.payload.items.length; i++) {
						const row = resData.payload.items[i];
						products.push({
							manufacturer: row.brand,
							manufacturer_code: row.originalNumber,
							source_reference_code: row.item.link.title,
							detailsUrl: `https://www.sf-filter.com${row.item.link.url}`
						});
					}
					return products;
				},
				pagination: 40
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
		// 			totalItems: null,
		// 			maxItemsPagination: null,
		// 			page: 0
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const responseData: ResponseSchema = await response.data;
		//
		// const products: Product[] = [];
		//
		// for (let i = 0; i < responseData.payload.items.length; i++) {
		// 	const row = responseData.payload.items[i];
		// 	products.push({
		// 		manufacturer: row.brand,
		// 		manufacturer_code: row.originalNumber,
		// 		source_reference_code: row.item.link.title,
		// 		detailsUrl: `https://www.sf-filter.com${row.item.link.url}`
		// 	});
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: null, //products.length,
		// 		//    nPages
		// 		// ? page === nPages
		// 		// 	? pagination * (nPages - 1) + products.length
		// 		// 	: `${pagination * (nPages - 1)}+`
		// 		// : null,
		// 		page: page,
		// 		maxItemsPagination: 40
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `SF error: ${err}`);
	}
};
// export async function getNextProducts(code: string, page: number): Promise<ProductsData> {
// 	const products = await getProducts(code, page + 1);
//
// 	return products;
// }

export const getNextProducts: GetNextProducts = () => null;
