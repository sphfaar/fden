import type ResponseSchema from './ResponseSchema';
import type { GetProducts, GetNextProducts } from '../types';
import { error } from '@sveltejs/kit';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.sf-filter.com/api/cross-reference/product-search',
		params: { limit: nItems, offset: 0, query: code },
		headers: {
			...headers,
			Host: 'www.sf-filter.com',
			Accept: 'application/json',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			TE: 'trailers',
			'content-type': 'application/json',
			'x-culture': 'en',
			Priority: 'u=6',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'sf',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.payload.items.length; i++) {
						const row = resData.payload.items[i];
						products.push({
							manufacturer: row.brand,
							manufacturer_code: row.originalNumber,
							source_reference_code: row.item.link.title,
							detailsUrl: `https://www.sf-filter.com${row.item.link.url}`
						});
					}
					return products;
				},
				pagination: nItems
			},
			config,
			page
		);
	} catch (err) {
		error(500, `SF error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = () => null;
