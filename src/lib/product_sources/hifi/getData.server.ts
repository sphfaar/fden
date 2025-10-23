import { error } from '@sveltejs/kit';
import type ResponseSchema from './ResponseSchema';
import type { GetNextProducts, GetProducts } from '../types';
import { getJsonToProducts } from '$lib/product_sources/getJsonToProductsData.server';
import { getProductThumbnails } from '$lib/product_sources/getProductsThumbnails.server';

export const getProducts: GetProducts = (code: string, config, page = 1) => {
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://catalog.hifi-filter.com/api/cross-reference/search',
		params: {
			q: code,
			p: page
		},
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
			Accept: 'application/json',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, zstd',
			'X-Api-Locale': 'en-GB',
			'Content-Length': '2',
			Origin: 'https://catalog.hifi-filter.com',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			TE: 'trailers'
		},
		data: '[]'
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'hifi',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.results.length; i++) {
						const row = resData.results[i];
						const detailsUrlComponent: string | undefined =
							row.products.length > 0
								? `${encodeURIComponent(row.products[0].reference)}/${encodeURIComponent(row.products[0].id)}`
								: undefined;
						products.push({
							manufacturer: row.brand.name,
							manufacturer_code: row.reference,
							source_reference_code:
								row.products.length > 0
									? row.products[0].reference
									: '🧐 No compatible HF reference',
							detailsUrl: detailsUrlComponent
								? `https://catalog.hifi-filter.com/en-GB/product/${detailsUrlComponent}`
								: undefined,
							thumbnails:
								row.products[0]?.photos && row.products[0].photos.length > 0
									? getProductThumbnails(
											row.products[0].photos.map(
												(photo) => `https://data.hifi-filter.com/media/product/photo/md-${photo.id}`
											)
										)
									: undefined
						});
					}
					return products;
				},
				nPages: (resData) => resData.paging.lastPage,
				pagination: (resData) => resData.paging.pageSize,
				totalItems: (resData) => resData.paging.totalFetched
			},
			config,
			page
		);
	} catch (err) {
		error(500, `HIFI error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = (code: string, config, page) =>
	getProducts(code, config, page + 1);
