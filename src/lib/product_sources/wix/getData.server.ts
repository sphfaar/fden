import { error } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from '../types';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';

export const getProducts: GetProducts = async (code, config) => {
	// const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www2.wixfilters.com/Lookup/NewCompetitor.aspx',
		params: { PartNo: code },
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			DNT: '1',
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
					for (let i = 0; i < tableRows.length; i++) {
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
		// const response = await fetch(
		// 	`https://www2.wixfilters.com/Lookup/NewCompetitor.aspx?PartNo=${codeEncoded}`,
		// 	{
		// 		headers: {
		// 			DNT: '1',
		// 			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
		// 		}
		// 	}
		// );
		//
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
		//
		// const tableRows = document.querySelectorAll('#gvPL > tr:not(:first-child)');
		// const products: Product[] = [];
		//
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const row = tableRows[i];
		// 	const srcRefCodeAnchor = row.querySelector('#hlPartNumber');
		// 	const urlPartDetail = srcRefCodeAnchor?.getAttribute('href')?.match(/Part=([^']*)'/)?.[1];
		// 	products.push({
		// 		manufacturer: row.querySelector(':nth-child(3)')?.textContent ?? '',
		// 		manufacturer_code: row.querySelector('#lblCompetitor')?.textContent ?? '',
		// 		source_reference_code: srcRefCodeAnchor?.textContent ?? '',
		// 		detailsUrl: `https://www2.wixfilters.com/Lookup/PartDetails.aspx?Part=${urlPartDetail}`
		// 	});
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: null,
		// 		page: 1,
		// 		maxItemsPagination: null
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `WIX error: ${err}`);
	}
};
export const getNextProducts: GetNextProducts = () => null;
