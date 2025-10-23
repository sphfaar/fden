import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { getProductThumbnails } from '../getProductsThumbnails.server';

export const getProducts: GetProducts = async (code: string, config, page: number = 1) => {
	const formattedCodeRgx = /[^a-zA-Z0-9]/gi;
	const formattedCode = code.replaceAll(formattedCodeRgx, '');
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://shop.donaldson.com/store/en-it/search',
		params: {
			No: `${20 * (page - 1)}`,
			Ntt: `${formattedCode}*`,
			Ntk: 'All',
			originalSearchTerm: `${code}*`,
			st: 'coparts'
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			Accept: 'application/json',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			DNT: '1',
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
							i < resData.contents[0].MainContent[0].competitorProductDetailDTOList.length;
							i++
						) {
							const row = resData.contents[0].MainContent[0].competitorProductDetailDTOList[i];
							products.push({
								manufacturer: row.manufactureName,
								manufacturer_code: row.manufacturerPartNumber,
								source_reference_code: row.donaldsonPartNumber,
								detailsUrl: `https://shop.donaldson.com/${row.pdpURL}`,
								thumbnails: row?.thumbnailImage
									? getProductThumbnails([row.thumbnailImage])
									: undefined,
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
				pagination: (resData) => resData.contents[0].MainContent[0].customerPartsPerPage ?? null,
				totalItems: (resData) => Number(resData.contents[0].MainContent[0].competitorPartsCount)
			},
			config,
			page
			// productsThumbnails
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
		// const responseData: ResponseSchema = await response.data;
		// const products: Product[] = [];
		// if (responseData.contents[0].MainContent[0].competitorProductDetailDTOList) {
		// 	for (
		// 		let i = 0;
		// 		i < responseData.contents[0].MainContent[0].competitorProductDetailDTOList.length;
		// 		i++
		// 	) {
		// 		const row = responseData.contents[0]MainContent[0].competitorProductDetailDTOList[i];
		// 		products.push({
		// 			manufacturer: row.manufactureName,
		// 			manufacturer_code: row.manufacturerPartNumber,
		// 			source_reference_code: row.donaldsonPartNumber,
		// 			detailsUrl: `https://shop.donaldson.com/${row.pdpURL}`
		// 		});
		// 	}
		// }
		//
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: responseData.contents[0].MainContent[0].competitorPartsCount ?? null,
		// 		maxItemsPagination: responseData.contents[0].MainContent[0].customerPartsPerPage ?? null,
		// 		page: page,
		// 		pages: Math.ceil(
		// 			(responseData.contents[0].MainContent[0].competitorPartsCount ?? NaN) /
		// 				(responseData.contents[0].MainContent[0].customerPartsPerPage ?? NaN)
		// 		)
		// 	},
		// 	products: products
		// };
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

export const getNextProducts: GetNextProducts = async (code, config, page) =>
	await getProducts(code, config, page + 1);
