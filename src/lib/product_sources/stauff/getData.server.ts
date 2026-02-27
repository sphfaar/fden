import type { GetNextProducts, GetProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, Infinity);

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
			'--stauff_filtersuche-results[offset]': nItems * (page - 1)
		},
		headers: {
			...headers,
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
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
				tableRows: (document) =>
					document.querySelectorAll('.filterliste.desktop > tbody > td'),
				rowsIterator: (tableRows) => {
					//tableRows are table cells in this source
					const products: Product[] = [];
					for (let index = 0; index < tableRows.length / 5; index++) {
						const j = index * 5;
						products.push({
							manufacturer:
								tableRows[j + 1].textContent?.replace(
									/[\w\W]*(Manufacturer:)\s/g,
									''
								) ?? '',
							manufacturer_code:
								tableRows[j + 1].textContent?.replace(/\n.*/, '') ?? '',
							source_reference_code: tableRows[j + 2].textContent ?? ''
						});
					}
					return products;
				},
				nPages: (document) =>
					Math.ceil(
						Number(document.getElementsByClassName('numresults')[0].textContent) /
							nItems
					),
				totalItems: (document) =>
					Number(document.getElementsByClassName('numresults')[0].textContent)
			},
			config,
			page,
			nItems
		);
	} catch (err) {
		error(500, `Stauff error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page: number) =>
	await getProducts(code, maxItems, config, page + 1);
