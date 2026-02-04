import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import type Response1Schema from './Response1Schema';
import { getJsonToProducts } from '$lib/product_sources/getJsonToProductsData.server';
import { headers } from '$lib/product_sources/constants';
import axios from 'axios';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	// const nItems = Math.min(maxItems, 10);
	const axiosReqConfig1 = {
		method: 'POST',
		url: 'https://www.fleetguard.com/webruntime/api/apex/execute',
		params: { language: 'en-US', asGuest: 'true', htmlEncode: 'false' },
		headers: {
			cookie: 'CookieConsentPolicy=0%3A1; LSKey-c%24CookieConsentPolicy=0%3A1',
			Accept: '*/*',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Accept-Language': 'en-US,en;q=0.5',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Content-Type': 'application/json; charset=utf-8',
			Host: 'www.fleetguard.com',
			Origin: 'https://www.fleetguard.com',
			Pragma: 'no-cache',
			Priority: 'u=0',
			Referer: 'https://www.fleetguard.com/results',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-GPC': '1',
			TE: 'trailers',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'
		},
		data: '{"namespace":"","classname":"@udd/01pPL000001p0qx","method":"fetchProductsFromParts","isContinuation":false,"params":{"searchTerm":"1000"},"cacheable":false}'
	};

	const res1 = await axios.request(axiosReqConfig1);
	const dataParsed = JSON.parse(res1.data.returnValue) as Response1Schema;

	// NOTE: Ids required for this specific source request params
	const paramsIds = dataParsed.products.map((p) => p.Id);

	const axiosReqConfig = {
		method: 'POST',
		url: 'https://www.fleetguard.com/webruntime/api/apex/execute',
		params: { language: 'en-US', asGuest: 'true', htmlEncode: 'false' },
		headers: {
			...headers,
			Accept: '*/*',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Accept-Language': 'en-US,en;q=0.9',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Content-Type': 'application/json',
			Host: 'www.fleetguard.com',
			Origin: 'https://www.fleetguard.com',
			Pragma: 'no-cache',
			Priority: 'u=4',
			Referer: 'https://www.fleetguard.com/results',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-GPC': '1',
			TE: 'trailers'
		},
		data: {
			namespace: '',
			classname: '@udd/01pPL000001p0qx',
			method: 'getProductDetailsFromParts',
			isContinuation: false,
			params: {
				ids: paramsIds,
				searchTerm: code,
				pageNumber: 1,
				pageSize: '5'
			},
			cacheable: false
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'fleetguard',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					console.log(resData);
					const products: Product[] = [];
					if (resData?.returnValue?.items != undefined) {
						for (let i = 0; i < resData?.returnValue?.items?.length; i++) {
							const row = resData?.returnValue?.items?.[i];
							if (row != undefined) {
								products.push({
									manufacturer:
										row.productDetailsWrapper.eqManufacturer ??
										'no manufacturer 🗿',
									manufacturer_code:
										row.productDetailsWrapper.crossReferenceName ??
										'no manuf. code 🧐',
									source_reference_code:
										row.productDetailsWrapper.productName ?? 'no cross code 🧐',
									thumbnails: [row.imageUrl]
								});
							}
						}
					}
					return products;
				}
			},
			config
		);
	} catch (err) {
		console.error('Fleetguard error', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				maxItemsPagination: null,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = () => null;
