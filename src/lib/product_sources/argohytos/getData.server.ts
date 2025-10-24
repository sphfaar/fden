import type { GetProducts, GetNextProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';

export const getProducts: GetProducts = async (code, config, page = 1) => {
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://portal.argo-hytos.com/core-app/api/elastic-search/oem-spare-parts',
		headers: {
			Accept: 'application/json, text/plain, */*',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Accept-Language': 'en-US,en;q=0.5',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Content-Length': '65',
			'Content-Type': 'application/json',
			Host: 'portal.argo-hytos.com',
			Origin: 'https://portal.argo-hytos.com',
			Pragma: 'no-cache',
			Referer: 'https://portal.argo-hytos.com/',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-GPC': '1',
			TE: 'trailers',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'
		},
		data: { term: code, filters: [], language: 'en', limit: 12, offset: (page - 1) * 12 }
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'argohytos',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];

					for (let i = 0; i < resData.data.length; i++) {
						const row = resData.data[i];
						products.push({
							manufacturer: row.referenceName,
							manufacturer_code: row.referenceNumber,
							source_reference_code: row.materialNumber,
							detailsUrl: `https://portal.argo-hytos.com/#/catalog/ai_argo_hytos_products/search/ai_filter_elements/product-details/${row.id}`,
							description: row.description,
							thumbnails: [row.imagePath],
							specs: row.dimension
								? {
										efficiency: row.dimension.match(/\d+/)?.[0] ?? undefined
									}
								: undefined
						});
					}
					return products;
				},
				nPages: (resData) => Math.ceil(resData.count / 12)
			},
			config,
			page
		);
	} catch (err) {
		console.error('argohytos error', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: null,
				maxItemsPagination: null,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = async (code, config, page = 1) =>
	await getProducts(code, config, page + 1);
