import { getJsonToProducts } from '../getJsonToProductsData.server';
import { getProductThumbnails } from '../getProductsThumbnails.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://www.hydac.com/en/e-tools/betterfit/betterfitSearch/',
		params: { query: code },
		headers: {
			Accept: '*/*',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
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
			TE: 'trailers',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'hydac',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.relation.length; i++) {
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
