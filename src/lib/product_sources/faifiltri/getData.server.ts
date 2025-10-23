import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';

export const getProducts: GetProducts = async (code: string, config, page = 1) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.faifiltri.it/elenco_risultati_cross.php',
		params: { idlingua: '318', codice_costruttore: code },
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			DNT: 1,
			'Sec-GPC': 1
		}
	};
	try {
		return getHtmlToProducts(
			'faifiltri',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('.table > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];

					for (let i = 0; i < tableRows.length; i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row.querySelector('th > div')?.textContent?.trim() ?? '',
							manufacturer_code:
								row.querySelector(':nth-child(2) > div')?.textContent?.trim() ?? '',
							source_reference_code:
								row.querySelector(':nth-child(3) > div')?.textContent?.trim() ?? ''
						});
					}
					return products;
				},
				totalItems: (document) =>
					parseInt(document.querySelector('.my-auto > span')?.textContent ?? '')
			},
			config,
			page
		);
		// const response = await fetch(
		// 	`https://www.faifiltri.it/elenco_risultati_cross.php?idlingua=318&codice_costruttore=${codeEncoded}`,
		// 	{
		// 		headers: {
		// 			DNT: '1',
		// 			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'
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
		// const nItems = document.querySelector('.my-auto > span')?.textContent;
		// const tableRows = document.querySelectorAll('.table > tbody > tr');
		//
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	products.push({
		// 		manufacturer: row.querySelector('th > div')?.textContent?.trim() ?? '',
		// 		manufacturer_code: row.querySelector(':nth-child(2) > div')?.textContent?.trim() ?? '',
		// 		source_reference_code: row.querySelector(':nth-child(3) > div')?.textContent?.trim() ?? ''
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
		error(500, `Faifiltri error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = () => null;
