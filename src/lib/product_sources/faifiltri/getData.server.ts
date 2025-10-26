import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '$lib/product_sources/getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.faifiltri.it/elenco_risultati_cross.php',
		params: { idlingua: '318', codice_costruttore: code },
		headers: {
			...headers,
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

					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
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
	} catch (err) {
		error(500, `Faifiltri error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = () => null;
