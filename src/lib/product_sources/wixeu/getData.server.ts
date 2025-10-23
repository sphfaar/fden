import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';

export const getProducts: GetProducts = async (code, config) => {
	// const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://wixeurope.com/en//find-a-filter?filtronNumber=${codeEncoded}&action=showFiltersByNumber&formType=1',
		params: {
			filtronNumber: code,
			action: 'showFiltersByNumber',
			formType: 1
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			DNT: '1',
			'Sec-GPC': '1'
		}
	};
	try {
		return getHtmlToProducts(
			'wixeu',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('#secondTable .tr:not(.thead)'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let i = 0; i < tableRows.length; i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row?.querySelector('.td:nth-child(2)')?.textContent?.trim() ?? '',
							manufacturer_code: row.querySelector('.td:nth-child(1)')?.textContent?.trim() ?? '',
							source_reference_code:
								row.querySelector('.td:nth-child(3)')?.textContent?.trim() ?? ''
						});
					}
					return products;
				},
				totalItems: (document) => document.querySelector('')?.textContent ?? null
			},
			config
		);
		// const response = await fetch(
		// 	`https://wixeurope.com/en//find-a-filter?filtronNumber=${codeEncoded}&action=showFiltersByNumber&formType=1`,
		// 	{
		// 		headers: {
		// 			DNT: '1',
		// 			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
		// 		}
		// 	}
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
		// const html = await response.text();
		// const { document } = parseHTML(html);
		// const nItems = document.querySelector('')?.textContent;
		// const tableRows = document.querySelectorAll('#secondTable .tr:not(.thead)');
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	products.push({
		// 		manufacturer: row?.querySelector('.td:nth-child(2)')?.textContent?.trim() ?? '',
		// 		manufacturer_code: row.querySelector('.td:nth-child(1)')?.textContent?.trim() ?? '',
		// 		source_reference_code: row.querySelector('.td:nth-child(3)')?.textContent?.trim() ?? ''
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: Number(nItems),
		// 		page: 1,
		// 		maxItemsPagination: null
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `WIX-EU error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
