import { error } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from '../types';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';

export const getProducts: GetProducts = async (code, config, page = 1) => {
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://www.mpfiltriusa.com/tools/interchange-filter-elements.html',
		headers: {
			cookie: 'mpfiltri=gi1hfjplvd0itqgu1ldbu2endl',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, zstd',
			Referer: 'https://www.mpfiltriusa.com/tools/interchange-filter-elements.html',
			Origin: 'https://www.mpfiltriusa.com',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-Fetch-User': '?1',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			DNT: '1'
		},
		data: { url: '', OEMSEARCH: `${code}*` }
	};
	try {
		return getHtmlToProducts(
			'mpfiltriusa',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('#myTable > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];

					for (let i = 0; i < tableRows.length; i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row.querySelector(':nth-child(2)')?.textContent ?? '',
							manufacturer_code: row.querySelector(':nth-child(1)')?.textContent ?? '',
							source_reference_code: row.querySelector(':nth-child(3)')?.textContent ?? ''
						});
					}
					return products;
				}
			},
			config,
			page
		);
		// const response = await fetch(
		// 	'https://www.mpfiltriusa.com/tools/interchange-filter-elements.html',
		// 	axiosReqConfig
		// );
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
		// const tableRows = document.querySelectorAll('#myTable > tbody > tr');
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	products.push({
		// 		manufacturer: row.querySelector(':nth-child(2)')?.textContent ?? '',
		// 		manufacturer_code: row.querySelector(':nth-child(1)')?.textContent ?? '',
		// 		source_reference_code: row.querySelector(':nth-child(3)')?.textContent ?? ''
		// 	});
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: products.length,
		// 		page: 1,
		// 		maxItemsPagination: null
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `MPfiltriUSA error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
