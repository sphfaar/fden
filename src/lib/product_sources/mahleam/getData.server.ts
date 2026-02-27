import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const nItems = Math.min(maxItems, 100);

	const axiosReqConfig = {
		method: 'POST',
		url: 'https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint',
		headers: {
			...headers,
			Host: 'webservice.tecalliance.services',
			Accept: 'application/json, text/plain, */*',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Content-Length': '1036',
			Origin: 'https://web.tecalliance.net',
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
				perPage: nItems,
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
				linkagesPerPage: nItems,
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
							manufacturer_code: row.gtins[0] ?? 'no code',
							source_reference_code: row.articleNumber
						});
					}
					return products;
				},
				nPages: (resData) => resData.maxAllowedPage,
				pagination: nItems,
				totalItems: (resData) => resData.totalMatchingArticles
			},
			config,
			page
		);
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

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page: number) =>
	await getProducts(code, maxItems, config, page + 1);
