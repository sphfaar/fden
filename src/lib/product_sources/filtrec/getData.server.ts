import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config, page: number = 1) => {
	// const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://cross-navigator.filtrec.com/api/cross-reference/search',
		params: {
			code: code,
			page: page,
			locale: 'it'
		},
		headers: {
			Host: 'cross-navigator.filtrec.com',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
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
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'filtrec',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.data.length; i++) {
						const row = resData.data[i];
						const pdfUrlcode = row.productCode.replaceAll('/', '-');
						products.push({
							manufacturer: row.manufacturer,
							manufacturer_code: row.code,
							source_reference_code: row.productCode,
							detailsUrl: `https://cross-navigator.filtrec.com/product/${pdfUrlcode}/pdf`
						});
					}
					return products;
				},
				nPages: (resData) => resData.meta.pageCount,
				pagination: (resData) => resData.meta.numItemsPerPage,
				totalItems: (resData) => resData.meta.totalCount
			},
			config,
			page
		);
		// const response = await fetch(
		// 	`https://cross-navigator.filtrec.com/api/cross-reference/search?code=${codeEncoded}&page=${page}&locale=it`,
		// 	{
		// 		method: 'GET',
		// 		headers: {
		// 			Host: 'cross-navigator.filtrec.com',
		// 			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
		// 			Accept: 'application/json',
		// 			'Accept-Language': 'en-US,en;q=0.5',
		// 			Referer: 'https://www.filtrec.com/',
		// 			Origin: 'https://www.filtrec.com',
		// 			'Sec-GPC': '1',
		// 			'Sec-Fetch-Dest': 'empty',
		// 			'Sec-Fetch-Mode': 'no-cors',
		// 			'Sec-Fetch-Site': 'same-site',
		// 			Priority: 'u=0',
		// 			Pragma: 'no-cache',
		// 			'Cache-Control': 'no-cache',
		// 			TE: 'trailers'
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
		//
		// const products: Product[] = [];
		// for (let i = 0; i < responseData.data.length; i++) {
		// 	const row = responseData.data[i];
		// 	const pdfUrlcode = row.productCode.replaceAll('/', '-');
		// 	products.push({
		// 		manufacturer: row.manufacturer,
		// 		manufacturer_code: row.code,
		// 		source_reference_code: row.productCode,
		// 		detailsUrl: `https://cross-navigator.filtrec.com/product/${pdfUrlcode}/pdf`
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: responseData.meta.currentItemCount,
		// 		totalItems: responseData.meta.totalCount,
		// 		maxItemsPagination: responseData.meta.numItemsPerPage,
		// 		page: responseData.meta.current,
		// 		pages: responseData.meta.pageCount
		// 	},
		// 	products: products
		// };
	} catch (err) {
		console.error('filtrec error', err);
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

export const getNextProducts: GetNextProducts = async (code: string, config, page: number) =>
	await getProducts(code, config, page + 1);
