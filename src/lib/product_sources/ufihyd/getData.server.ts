import { error } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from '../types';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';

export const getProducts: GetProducts = async (code: string, config) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://crossreference.ufihyd.com/',
		params: { s: code },
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			DNT: '1',
			'Sec-GPC': '1'
		}
	};
	try {
		return getHtmlToProducts(
			'ufihyd',
			axiosReqConfig,
			{
				tableRows: (document) => document.getElementsByClassName('codice'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];

					for (let i = 0; i < tableRows.length; i++) {
						const row = tableRows[i];
						const detailsUrlElement = row.querySelector('.ufi-code a') as
							| HTMLAnchorElement
							| undefined
							| null;
						products.push({
							manufacturer: row.querySelector('.manufacturer-code span')?.textContent ?? '',
							manufacturer_code: row.querySelector('.manufacturer-code span')?.textContent ?? '',
							source_reference_code: row.querySelector('.ufi-code a span')?.textContent ?? '',
							detailsUrl: detailsUrlElement?.href ?? ''
						});
					}
					return products;
				}
			},
			config
		);
		// const response = await fetch(`https://crossreference.ufihyd.com/?s=${codeEncoded}`, {
		// 	headers: {
		// 		'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'
		// 	}
		// });
		// if (!response.ok) {
		// 	return {
		// 		meta: {
		// 			status: response.status,
		// 			currentItemsDisplayed: 0,
		// 			totalItems: null,
		// 			page: 0,
		// 			maxItemsPagination: null
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const html = await response.text();
		//
		// const { document } = parseHTML(html);
		//
		// const tableRows = document.getElementsByClassName('codice');
		//
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	const detailsUrlElement = row.querySelector('.ufi-code a') as
		// 		| HTMLAnchorElement
		// 		| undefined
		// 		| null;
		// 	products.push({
		// 		manufacturer: row.querySelector('.manufacturer-code span')?.textContent ?? '',
		// 		manufacturer_code: row.querySelector('.manufacturer-code span')?.textContent ?? '',
		// 		source_reference_code: row.querySelector('.ufi-code a span')?.textContent ?? '',
		// 		detailsUrl: detailsUrlElement?.href ?? ''
		// 	});
		// }
		//
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
		error(500, `UFI hyd. error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
