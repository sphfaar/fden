import type ResponseSchema from './ResponseSchema';
import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '#lib/product_sources/getHtmlToProductsData.server.js';
import { headers } from '#lib/product_sources/constants.js';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';

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
						const thumbnail = catalogHttpsUrl(
							row.querySelector('img')?.getAttribute('src'),
							'https://shopindustrial.filtrationgroup.com/'
						);
						products.push({
							manufacturer: row.querySelector(':nth-child(3)')?.textContent?.trim() ?? '',
							manufacturer_code: row.querySelector(':nth-child(1)')?.textContent?.trim() ?? '',
							source_reference_code:
								row.getElementsByClassName('fg_additional_product_info')[0]?.textContent?.trim() ??
								'',
							thumbnails: thumbnail ? [thumbnail] : undefined
						});
					}
					return products;
				},
				documentToHtml: (resData) => resData.template
			},
			config
		);
	} catch (err) {
		error(500, `Filtration Group error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
