import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '$lib/product_sources/getJsonToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const nItems = Math.min(maxItems, 20);

	const formattedCodeRgx = /[^a-zA-Z0-9]/gi;
	const formattedCode = code.replaceAll(formattedCodeRgx, '');
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://shop.donaldson.com/store/en-it/search',
		params: {
			No: `${nItems * (page - 1)}`,
			Ntt: `${formattedCode}*`,
			Ntk: 'All',
			originalSearchTerm: `${code}*`,
			st: 'coparts'
		},
		headers: {
			...headers,
			Accept: 'application/json',
			'Accept-Language': 'en-US,en;q=0.5',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-site',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			TE: 'trailers'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'donaldson',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					if (resData.contents[0].MainContent[0].competitorProductDetailDTOList) {
						for (
							let i = 0;
							i <
							resData.contents[0].MainContent[0].competitorProductDetailDTOList
								.length;
							i++
						) {
							const row =
								resData.contents[0].MainContent[0].competitorProductDetailDTOList[
									i
								];
							products.push({
								manufacturer: row.manufactureName,
								manufacturer_code: row.manufacturerPartNumber,
								source_reference_code: row.donaldsonPartNumber,
								detailsUrl: `https://shop.donaldson.com/${row.pdpURL}`,
								thumbnails: row?.thumbnailImage ? [row.thumbnailImage] : undefined,
								description: row.description,
								category: row.productLine
							});
						}
					}
					return products;
				},
				nPages: (resData) =>
					Math.ceil(
						(resData.contents[0].MainContent[0].competitorPartsCount ?? NaN) /
							(resData.contents[0].MainContent[0].customerPartsPerPage ?? NaN)
					),
				pagination: (resData) =>
					resData.contents[0].MainContent[0].customerPartsPerPage ?? null,
				totalItems: (resData) =>
					Number(resData.contents[0].MainContent[0].competitorPartsCount)
			},
			config,
			page
			// productsThumbnails
		);
	} catch (err) {
		console.error('Donaldson error', err);
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

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page) =>
	await getProducts(code, maxItems, config, page + 1);
