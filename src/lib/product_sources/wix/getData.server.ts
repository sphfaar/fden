import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const nItems = Math.min(maxItems, Infinity);
	// const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www2.wixfilters.com/Lookup/NewCompetitor.aspx',
		params: { PartNo: code },
		headers: {
			...headers,
			'Sec-GPC': '1'
		}
	};
	try {
		return getHtmlToProducts(
			'wix',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('#gvPL > tr:not(:first-child)'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
						const row = tableRows[i];
						const srcRefCodeAnchor = row.querySelector('#hlPartNumber');
						const urlPartDetail = srcRefCodeAnchor
							?.getAttribute('href')
							?.match(/Part=([^']*)'/)?.[1];
						products.push({
							manufacturer: row.querySelector(':nth-child(3)')?.textContent ?? '',
							manufacturer_code: row.querySelector('#lblCompetitor')?.textContent ?? '',
							source_reference_code: srcRefCodeAnchor?.textContent ?? '',
							detailsUrl: `https://www2.wixfilters.com/Lookup/PartDetails.aspx?Part=${urlPartDetail}`
						});
					}
					return products;
				}
			},
			config
		);
	} catch (err) {
		error(500, `WIX error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
