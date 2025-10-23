import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

export const getProducts: GetProducts = async (code: string, config) => {
	const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://www.fleetguard.com/s/sfsites/aura',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
			Connection: 'keep-alive',
			TE: 'trailers',
			'Sec-GPC': '1',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'no-cors',
			'Sec-Fetch-Site': 'same-origin',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			DNT: '1'
		},
		data: new URLSearchParams({
			message: `{"actions":[{"id":"364;a","descriptor":"aura://ApexActionController/ACTION$execute","callingDescriptor":"UNKNOWN","params":{"namespace":"","classname":"SearchedEquipmentsList","method":"getHybridData","params":{"queryTerm":"${code}*","effAccountId":null,"country":"US"},"cacheable":false,"isContinuation":false}},{"id":"365;a","descriptor":"aura://ApexActionController/ACTION$execute","callingDescriptor":"UNKNOWN","params":{"namespace":"","classname":"SearchedEquipmentsList","method":"checkIfFuzzySearch","params":{"queryTerm":"${code}"},"cacheable":false,"isContinuation":false}},{"id":"366;a","descriptor":"aura://ApexActionController/ACTION$execute","callingDescriptor":"UNKNOWN","params":{"namespace":"","classname":"SearchedProductList","method":"fetchGuestDatafromSolr","params":{"queryTerm":"${code}","region":"North America","featuredProducts":false,"ShowTop100GLobalRankProduct":false,"country":"US","language":"en_US","isExportFile":false},"cacheable":false,"isContinuation":false}},{"id":"367;a","descriptor":"aura://ApexActionController/ACTION$execute","callingDescriptor":"UNKNOWN","params":{"namespace":"","classname":"VINSearchCtrl","method":"getAccountinfo","params":{"effAccountId":null},"cacheable":false,"isContinuation":false}}]}`,
			'aura.context':
				'{"mode":"PROD","fwuid":"dzlEdDRVZ1RsVXFtVkduczVYNVVfZ1ZuNVJhc1EyaHA2ZTdMUkxCNEw5Y1E5LjMyMC4y","app":"siteforce:communityApp","loaded":{"APPLICATION@markup://siteforce:communityApp":"1180_5uipvNSFkxlY1lsD8egjIg","COMPONENT@markup://instrumentation:o11ySecondaryLoader":"339_lEKKeOv6XZLjJ9zHNYkGPw"},"dn":[],"globals":{},"uad":false}',
			'aura.pageURI': `/s/searchResults?propertyVal=${codeEncoded}&hybridSearch=true&uom=Metric&lainguage=en_US`,
			'aura.token': 'null'
		})
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'fleetguard',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					if (resData?.actions?.[2]?.returnValue?.returnValue?.productSearchData != undefined) {
						for (
							let i = 0;
							i < resData?.actions?.[2]?.returnValue?.returnValue?.productSearchData?.length;
							i++
						) {
							const row = resData?.actions?.[2]?.returnValue?.returnValue?.productSearchData?.[i];
							if (row != undefined) {
								products.push({
									manufacturer: row.eqManufacturer ?? 'no manufacturer 🗿',
									manufacturer_code: row.competitorPN ?? 'no manuf. code 🧐',
									source_reference_code: row.crossReferenceName ?? 'no cross code 🧐'
								});
							}
						}
					}
					return products;
				}
			},
			config
		);
		// const response = await fetch('https://www.fleetguard.com/s/sfsites/aura', axiosReqConfig);
		//
		// if (!response.ok) {
		// 	return {
		// 		meta: {
		// 			status: response.status,
		// 			currentItemsDisplayed: 0,
		// 			totalItems: 0,
		// 			maxItemsPagination: null,
		// 			page: 0
		// 		},
		// 		products: []
		// 	};
		// }
		//
		// const responseData: ResponseSchema = await response.json();
		//
		// const products: Product[] = [];
		//
		// if (responseData?.actions?.[2]?.returnValue?.returnValue?.productSearchData != undefined) {
		// 	for (
		// 		let i = 0;
		// 		i < responseData?.actions?.[2]?.returnValue?.returnValue?.productSearchData?.length;
		// 		i++
		// 	) {
		// 		const row = responseData?.actions?.[2]?.returnValue?.returnValue?.productSearchData?.[i];
		// 		if (row != undefined) {
		// 			products.push({
		// 				manufacturer: row.eqManufacturer ?? '',
		// 				manufacturer_code: row.competitorPN ?? '',
		// 				source_reference_code: row.productName
		// 			});
		// 		}
		// 	}
		// }
		// return {
		// 	meta: {
		// 		status: response.status,
		// 		currentItemsDisplayed: products.length,
		// 		totalItems: products.length,
		// 		maxItemsPagination: null,
		// 		page: 1
		// 	},
		// 	products: products
		// };
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
