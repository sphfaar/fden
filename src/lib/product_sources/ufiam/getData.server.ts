import { getJsonToProducts } from '../getJsonToProductsData.server';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { headers } from '../constants';

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const codeEncoded = encodeURIComponent(code);
	const nItems = Math.min(maxItems, 1000);

	const axiosReqConfig = {
		method: 'POST',
		url: 'https://shop.ufi-aftermarket.com/it/s/sfsites/aura',
		headers: {
			...headers,
			Accept: '*/*',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
			Origin: 'https://shop.ufi-aftermarket.com',
			Connection: 'keep-alive',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			TE: 'trailers',
			'Sec-GPC': '1'
		},
		data: {
			message: `{"actions":[{"id":"140;a","descriptor":"aura://ApexActionController/ACTION$execute","callingDescriptor":"UNKNOWN","params":{"namespace":"","classname":"B2B_CompetitorController","method":"getCompetitorsTable","params":{"searchKey":"${code}","nLimit":${nItems},"offset":${((page - 1) * nItems).toString()}},"cacheable":false,"isContinuation":false}}]}`,
			'aura.context':
				'{"mode":"PROD","fwuid":"eUNJbjV5czdoejBvRlA5OHpDU1dPd1pMVExBQkpJSlVFU29Ba3lmcUNLWlE5LjMyMC4y","app":"siteforce:communityApp","loaded":{"APPLICATION@markup://siteforce:communityApp":"1183_iYPVTlE11xgUFVH2RcHXYA"},"dn":[],"globals":{},"uad":true}',
			'aura.pageURI': `/it/s/catalogue?language=en_US&category=freeSearch&searchText=${codeEncoded}`,
			'aura.token': 'null'
		}
	};
	try {
		return getJsonToProducts<ResponseSchema>(
			'ufiam',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					if (resData?.actions?.[0]?.returnValue?.returnValue?.hits != undefined) {
						for (
							let i = 0;
							i < resData?.actions?.[0]?.returnValue?.returnValue?.hits?.length;
							i++
						) {
							const row =
								resData?.actions?.[0]?.returnValue?.returnValue?.hits?.[i]._source;
							if (row != undefined) {
								products.push({
									manufacturer: row.manufacturer ?? 'no manufacturer 🗿',
									manufacturer_code: row.cross_code ?? 'no manuf. code 🧐',
									source_reference_code: row.filter ?? 'no cross code 🧐'
								});
							}
						}
					}
					return products;
				},
				nPages: (resData) =>
					Math.ceil(resData.actions[0].returnValue.returnValue.total.value / nItems),
				totalItems: (resData) => resData.actions[0].returnValue.returnValue.total.value
			},
			config,
			page
		);
	} catch (err) {
		console.error('UFI-aftermarket error', err);
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

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
