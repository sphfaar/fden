import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://crossreference.ufihyd.com/',
		params: { s: code },
		headers: {
			...headers,
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

					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
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
	} catch (err) {
		error(500, `UFI hyd. error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
