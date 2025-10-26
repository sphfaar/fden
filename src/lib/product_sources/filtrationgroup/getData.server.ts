import type ResponseSchema from './ResponseSchema';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '$lib/product_sources/getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';
import type { GetNextProducts, GetProducts } from '../types';

export const getProducts: GetProducts = async (code: string, maxItems, config) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://shopindustrial.filtrationgroup.com/competitor/product/search',
		params: { search_query: code },
		headers: {
			...headers,
			Accept: 'application/json, text/javascript, */*; q=0.01',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, zstd',
			Referer: 'https://shopindustrial.filtrationgroup.com/en/comparison-list.html',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			TE: 'trailers',
			'X-Requested-With': 'XMLHttpRequest',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getHtmlToProducts<ResponseSchema>(
			'filtrationgroup',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('.data.table > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row.querySelector(':nth-child(3)')?.textContent?.trim() ?? '',
							manufacturer_code: row.querySelector(':nth-child(1)')?.textContent?.trim() ?? '',
							source_reference_code:
								row.getElementsByClassName('fg_additional_product_info')[0]?.textContent?.trim() ??
								''
						});
					}
					return products;
				},
				documentToHtml: (resData) => resData.template
			},
			config
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
		// const data: ResponseSchema = await response.data;
		//
		// const { document } = parseHTML(data.template);
		//
		// const tableRows = document.querySelectorAll('.data.table > tbody > tr');
		//
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	products.push({
		// 		manufacturer: row.querySelector(':nth-child(3)')?.textContent?.trim() ?? '',
		// 		manufacturer_code: row.querySelector(':nth-child(1)')?.textContent?.trim() ?? '',
		// 		source_reference_code:
		// 			row.getElementsByClassName('fg_additional_product_info')[0]?.textContent?.trim() ?? ''
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: null,
		// 		page: 1,
		// 		maxItemsPagination: null
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `Filtration Group error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
