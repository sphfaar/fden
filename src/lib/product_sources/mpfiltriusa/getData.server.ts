import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'POST',
		url: 'https://www.mpfiltriusa.com/tools/interchange-filter-elements.html',
		headers: {
			...headers,
			cookie: 'mpfiltri=gi1hfjplvd0itqgu1ldbu2endl',
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept-Language': 'en-US,en;q=0.5',
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
			'Cache-Control': 'no-cache'
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

					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row.querySelector(':nth-child(2)')?.textContent ?? '',
							manufacturer_code:
								row.querySelector(':nth-child(1)')?.textContent ?? '',
							source_reference_code:
								row.querySelector(':nth-child(3)')?.textContent ?? ''
						});
					}
					return products;
				}
			},
			config,
			page
		);
	} catch (err) {
		error(500, `MPfiltriUSA error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
