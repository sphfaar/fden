import type { GetProducts, GetNextProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';

export const getProducts: GetProducts = async (code, config, page = 1) => {
	const axiosReqConfig = {
		method: 'GET',
		url: 'https://backend.argo-hytos.com/INTERSHOP/rest/WFS/ARGOHYTOS-AHDE-Site/rest;loc=en_DE;cur=EUR/products',
		params: {
			searchTerm: code,
			amount: '12',
			offset: (page - 1) * 12,
			attrs:
				'sku,availability,manufacturer,image,minOrderQuantity,maxOrderQuantity,stepOrderQuantity,inStock,promotions,packingUnit,mastered,productMaster,productMasterSKU,roundedAverageRating,retailSet,defaultCategory',
			attributeGroup: 'PRODUCT_LABEL_ATTRIBUTES,SEARCH_DETAIL_ATTRIBUTES',
			returnSortKeys: 'true'
		},
		headers: {
			Host: 'backend.argo-hytos.com',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			Accept: 'application/json',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'content-type': 'application/json',
			Origin: 'https://portal.argo-hytos.com',
			DNT: '1',
			Connection: 'keep-alive',
			Referer: 'https://portal.argo-hytos.com/',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-site',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'argohytos',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];

					for (let i = 0; i < resData.elements.length; i++) {
						const row = resData.elements[i];
						row.attributeGroups.SEARCH_DETAIL_ATTRIBUTES.attributes
							.find((attribute) => attribute.name === 'FullCompetitorIDs')
							?.value.forEach((fullCompetitorID) => {
								const [manufacturer, manufacturerCode] = fullCompetitorID.split('__');
								if (manufacturerCode.includes(code))
									products.push({
										manufacturer: manufacturer,
										manufacturer_code: manufacturerCode,
										source_reference_code:
											typeof row.attributes[0].value === 'string' ? row.attributes[0].value : ''
									});
							});
					}
					return products;
				},
				nPages: (resData) => Math.ceil(resData.total / resData.amount)
			},
			config,
			page
		);
		// if (config.showPerfReqProxyToSource) performance.mark('argohytos-req-start');
		// const response = await axios.request(options);
		// if (response.status >= 400) {
		// 	return {
		// 		meta: {
		// 			status: response.status,
		// 			currentItemsDisplayed: 0,
		// 			totalItems: null,
		// 			maxItemsPagination: null,
		// 			page: 0
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const responseData: ResponseSchema = await response.data;
		// if (config.showPerfReqProxyToSource) performance.mark('argohytos-req-end');
		//
		// if (config.showPerfParsing) performance.mark('argohytos-parse-start');
		// const products: Product[] = [];
		//
		// for (let i = 0; i < responseData.elements.length; i++) {
		// 	const row = responseData.elements[i];
		// 	row.attributeGroups.SEARCH_DETAIL_ATTRIBUTES.attributes
		// 		.find((attribute) => attribute.name === 'FullCompetitorIDs')
		// 		?.value.forEach((fullCompetitorID) => {
		// 			const [manufacturer, manufacturerCode] = fullCompetitorID.split('__');
		// 			if (manufacturerCode.includes(code))
		// 				products.push({
		// 					manufacturer: manufacturer,
		// 					manufacturer_code: manufacturerCode,
		// 					source_reference_code:
		// 						typeof row.attributes[0].value === 'string' ? row.attributes[0].value : ''
		// 				});
		// 		});
		// }
		// if (config.showPerfParsing) performance.mark('argohytos-parse-end');
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: null,
		// 		maxItemsPagination: null,
		// 		page: page,
		// 		pages: Math.ceil(responseData.total / responseData.amount),
		// 		performanceTimings: {
		// 			fetchTimings: {
		// 				proxyToSource: config.showPerfReqProxyToSource
		// 					? performance.measure('argohytos-req', 'argohytos-req-end').duration
		// 					: null
		// 			},
		// 			parsing: config.showPerfParsing
		// 				? performance.measure('argohytos-parse', 'argohytos-parse-end').duration
		// 				: null
		// 		}
		// 	},
		// 	products: products
		// };
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
