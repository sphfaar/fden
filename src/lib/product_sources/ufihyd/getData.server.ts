import type { GetNextProducts, GetProducts } from '../types';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '#lib/product_sources/constants.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';

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
							HTMLAnchorElement | undefined | null;
						products.push({
							manufacturer: row.querySelector('.manufacturer-code span')?.textContent ?? '',
							manufacturer_code: row.querySelector('.manufacturer-code span')?.textContent ?? '',
							source_reference_code: row.querySelector('.ufi-code a span')?.textContent ?? '',
							detailsUrl: catalogHttpsUrl(
								detailsUrlElement?.getAttribute('href'),
								'https://crossreference.ufihyd.com/'
							)
						});
					}
					return products;
				}
			},
			config
		);
	} catch (err) {
		failSourceRequest(err, 'UFI hyd. error');
	}
};
export const getNextProducts: GetNextProducts = () => undefined;
