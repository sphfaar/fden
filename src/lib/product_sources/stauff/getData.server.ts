import { error } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from '../types';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';

export const getProducts: GetProducts = async (code: string, config, page = 1) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.filterinterchange.com/en/filter-interchange/results.html',
		params: {
			q: code,
			x: '0',
			y: '0',
			'--stauff_filtersuche-results[@package]': 'stauff.filtersuche',
			'--stauff_filtersuche-results[@controller]': 'standard',
			'--stauff_filtersuche-results[@action]': 'listen',
			'--stauff_filtersuche-results[q]': code,
			'--stauff_filtersuche-results[offset]': 10 * (page - 1)
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			Accept:
				'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'none',
			'Sec-Fetch-User': '?1',
			Priority: 'u=0, i',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getHtmlToProducts(
			'stauff',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('.filterliste.desktop > tbody > td'),
				rowsIterator: (tableRows) => {
					//tableRows are table cells in this source
					const products: Product[] = [];
					for (let index = 0; index < tableRows.length / 5; index++) {
						const j = index * 5;
						products.push({
							manufacturer:
								tableRows[j + 1].textContent?.replace(/[\w\W]*(Manufacturer:)\s/g, '') ?? '',
							manufacturer_code: tableRows[j + 1].textContent?.replace(/\n.*/, '') ?? '',
							source_reference_code: tableRows[j + 2].textContent ?? ''
						});
					}
					return products;
				},
				nPages: (document) =>
					Math.ceil(Number(document.getElementsByClassName('numresults')[0].textContent) / 10),
				totalItems: (document) =>
					Number(document.getElementsByClassName('numresults')[0].textContent)
			},
			config,
			page,
			10
		);
		// const response = await axios.request(axiosReqConfig);
		// if (response.status >= 400) {
		// 	return {
		// 		meta: {
		// 			status: response.status,
		// 			currentItemsDisplayed: 0,
		// 			totalItems: 0,
		// 			maxItemsPagination: 0,
		// 			page: 0
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const html = await response.data;
		//
		// const { document } = parseHTML(html);
		//
		// const tableCells = document.querySelectorAll('.filterliste.desktop > tbody > td');
		//
		// const products: Product[] = [];
		// for (let index = 0; index < tableCells.length / 5; index++) {
		// 	const j = index * 5;
		// 	products.push({
		// 		manufacturer: tableCells[j + 1].textContent?.replace(/[\w\W]*(Manufacturer:)\s/g, '') ?? '',
		// 		manufacturer_code: tableCells[j + 1].textContent?.replace(/\n.*/, '') ?? '',
		// 		source_reference_code: tableCells[j + 2].textContent ?? ''
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: Number(document.getElementsByClassName('numresults')[0].textContent),
		// 		page: page,
		// 		maxItemsPagination: 10
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `Stauff error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = async (code: string, config, page: number) =>
	await getProducts(code, config, page + 1);
