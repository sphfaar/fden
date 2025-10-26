import type { GetProducts, GetNextProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	// const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://catalog.hengst.com/en/online-catalog/search-results/ajax.api',
		params: {
			catalog: 'it',
			'request[mvc][vendor]': 'UiHengst',
			'request[mvc][extensionName]': 'UiHengst',
			'request[mvc][pluginName]': 'Uihengst',
			'request[mvc][controller]': 'Hengst',
			'request[mvc][action]': 'searchResultTableAjax',
			'request[arguments][searchType]': 'freetext',
			'request[arguments][freetext]': code,
			'request[arguments][resultTable]': 'ref',
			'request[arguments][page]': page,
			'request[arguments][limit]': '',
			'request[arguments][sort]': 'type',
			'request[arguments][sort_order]': 'asc'
		},
		headers: {
			...headers,
			cookie: 'catalog=it',
			Host: 'catalog.hengst.com',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			Referer: 'https://catalog.hengst.com/en/online-catalog/search/?catalog=it',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-Fetch-User': '?1',
			Priority: 'u=0, i',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getHtmlToProducts(
			'hengst',
			axiosReqConfig,
			{
				tableRows: (document) => document.getElementsByClassName('result-table__table-mobile-row'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let i = 0; i < tableRows.length; i++) {
						const rowItems = tableRows[i].getElementsByClassName(
							'result-table__table-mobile-row__item'
						);
						const productUrl = tableRows[i].getElementsByClassName('result-table__linkbtn')[0];
						products.push({
							manufacturer:
								rowItems[1].getElementsByClassName('result-table__table-mobile-row__item-col')[1]
									?.textContent ?? '',
							manufacturer_code:
								rowItems[0].getElementsByClassName('result-table__table-mobile-row__item-col')[1]
									?.textContent ?? '',
							source_reference_code: productUrl?.textContent?.trim() ?? '',
							detailsUrl: productUrl?.getAttribute('href') ?? undefined
						});
					}
					return products;
				},
				nPages: (document: Document) =>
					Number(
						document.getElementsByClassName('result-table__pagination__paging')[2]?.textContent
					),
				totalItems: (document: Document, page?: number, nProducts?: number, nPages?: number) => {
					if (document && nPages && nProducts && page) {
						if (nPages === 2) {
							if (page === 1) return String(nProducts + '+');
							return 50 * (page - 1) + nProducts;
						}
						return null;
					}
					return null;
				}
			},
			config,
			page,
			50
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
		// const tableRows = document.getElementsByClassName('result-table__table-mobile-row');
		// const products: Product[] = [];
		// const nPages: number = Number(
		// 	document.getElementsByClassName('result-table__pagination__paging')[2]?.textContent
		// );
		// for (let i = 0; i < tableRows.length; i++) {
		// 	const rowItems = tableRows[i].getElementsByClassName('result-table__table-mobile-row__item');
		// 	const productUrl = tableRows[i].getElementsByClassName('result-table__linkbtn')[0];
		// 	products.push({
		// 		manufacturer:
		// 			rowItems[1].getElementsByClassName('result-table__table-mobile-row__item-col')[1]
		// 				?.textContent ?? '',
		// 		manufacturer_code:
		// 			rowItems[0].getElementsByClassName('result-table__table-mobile-row__item-col')[1]
		// 				?.textContent ?? '',
		// 		source_reference_code: productUrl?.textContent?.trim() ?? '',
		// 		detailsUrl: productUrl?.getAttribute('href') ?? undefined
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems:
		// 			nPages === 2 && page === 1
		// 				? String(products.length + '+')
		// 				: 50 * (page - 1) + products.length,
		// 		page: page,
		// 		pages: nPages,
		// 		maxItemsPagination: 50
		// 	},
		// 	products: products
		// };
	} catch (err) {
		error(500, `Hengst error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page = 1) =>
	await getProducts(code, maxItems, config, page + 1);
