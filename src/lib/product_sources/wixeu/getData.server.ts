import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const nItems = Math.min(maxItems, Infinity);
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
			...headers,
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
					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
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
				totalItems: (document) =>
					Math.min(Number(document.querySelector('')?.textContent ?? NaN), nItems) ?? null
			},
			config
		);
	} catch (err) {
		error(500, `WIX-EU error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
