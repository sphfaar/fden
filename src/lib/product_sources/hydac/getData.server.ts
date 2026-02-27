import { getJsonToProducts } from '../getJsonToProductsData.server';
import { getProductThumbnails } from '../getProductsThumbnails.server';
import { headers } from '$lib/product_sources/constants';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	const nItems = Math.min(maxItems, Infinity);

	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.hydac.com/en/e-tools/betterfit/betterfitSearch/',
		params: { query: code },
		headers: {
			...headers,
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			Host: 'www.hydac.com',
			Pragma: 'no-cache',
			Priority: 'u=0',
			Referer: 'https://www.hydac.com/en/e-tools/betterfit/',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-GPC': '1',
			TE: 'trailers'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'hydac',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < Math.min(resData.relation.length, nItems); i++) {
						const row = resData.relation[i];
						products.push({
							manufacturer: row.competitor.manufacturer.title,
							manufacturer_code: row.competitor.title,
							source_reference_code: row.hydac.title,
							thumbnails: getProductThumbnails([row.hydac.image.src])
						});
					}
					return products;
				}
			},
			config
		);
	} catch (err) {
		console.error('Hydac error', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				maxItemsPagination: 0,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = () => null;
