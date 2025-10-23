import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config, page: number = 1) => {
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint',
		headers: {
			Host: 'webservice.tecalliance.services',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			Accept: 'application/json, text/plain, */*',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Content-Length': '1036',
			Origin: 'https://web.tecalliance.net',
			DNT: '1',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'cross-site',
			TE: 'trailers',
			'Content-Type': 'application/json',
			Referer: 'https://web.tecalliance.net/',
			Priority: 'u=4',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		},
		data: {
			getArticles: {
				applyDqmRules: true,
				articleCountry: 'DE',
				provider: 22620,
				lang: 'en',
				searchQuery: code,
				searchMatchType: 'prefix_or_suffix',
				searchType: 10,
				page: page,
				perPage: 100,
				sort: [
					{ field: 'score', direction: 'desc' },
					{ field: 'mfrName', direction: 'asc' },
					{ field: 'linkageSortNum', direction: 'asc' }
				],
				filterQueries: ['(dataSupplierId NOT IN (4978,4982))'],
				dataSupplierIds: [],
				genericArticleIds: [],
				includeAll: false,
				includeLinkages: true,
				linkagesPerPage: 100,
				includeGenericArticles: true,
				includeArticleCriteria: true,
				includeMisc: true,
				includeImages: true,
				includePDFs: true,
				includeLinks: true,
				includeArticleText: true,
				includeOEMNumbers: true,
				includeReplacedByArticles: true,
				includeReplacesArticles: true,
				includeComparableNumbers: true,
				includeGTINs: true,
				includeTradeNumbers: true,
				includePrices: false,
				includePartsListArticles: false,
				includeAccessoryArticles: false,
				includeArticleLogisticsCriteria: true,
				includeDataSupplierFacets: true,
				includeGenericArticleFacets: true,
				includeCriteriaFacets: false
			}
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'mahleam',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.articles.length; i++) {
						const row = resData.articles[i];
						products.push({
							manufacturer: row.mfrName,
							manufacturer_code: row.gtins[0] ?? '🤔 no codes',
							source_reference_code: row.articleNumber
						});
					}
					return products;
				},
				nPages: (resData) => resData.maxAllowedPage,
				pagination: 100,
				totalItems: (resData) => resData.totalMatchingArticles
			},
			config,
			page
		);
		// const response = await axios.request(axiosReqConfig);
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
		// const products: Product[] = [];
		// if (responseData.status === 400) {
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
		// for (let i = 0; i < responseData.articles.length; i++) {
		// 	const row = responseData.articles[i];
		// 	products.push({
		// 		manufacturer: row.mfrName,
		// 		manufacturer_code: row.gtins[0] ?? '🤔 no codes',
		// 		source_reference_code: row.articleNumber
		// 	});
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: responseData.articles.length,
		// 		totalItems: responseData.totalMatchingArticles,
		// 		maxItemsPagination: 100,
		// 		page: page,
		// 		pages: responseData.maxAllowedPage
		// 	},
		// 	products: products
		// };
	} catch (err) {
		console.error('mahle (aftermarket) error', err);
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

export const getNextProducts: GetNextProducts = async (code: string, config, page: number) =>
	await getProducts(code, config, page + 1);
