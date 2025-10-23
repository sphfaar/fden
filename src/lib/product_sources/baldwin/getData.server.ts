import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';
import { getJsonToProducts } from '../getJsonToProductsData.server';

export const getProducts: GetProducts = async (code: string, config, page = 1) => {
	const formattedCode = code.replaceAll(/[^\w]/g, '').toUpperCase();
	const axiosReqConfig = {
		method: 'POST',
		url: 'https://www.baldwinfilters.com/content/baldwin-filters/us/en/cross-reference-result-page.data.json',
		headers: {
			Host: 'www.baldwinfilters.com',
			'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
			'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Content-Type': 'application/json',
			Origin: 'null',
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'cross-site',
			Priority: 'u=0, i',
			TE: 'trailers'
		},
		data: {
			url: `https://api.parker.com/prod/baldwinsearch/BaldwinECatalog/select?fq=coreName_s:BaldwinCrossRefData&=&wt=json&indent=true&group=true&group.offset=0&group.query=compPartId_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20OR%20*${formattedCode}*)&q=compPartId_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20OR%20*${formattedCode}*%20)%5E1%20OR%20partNumber_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20)%5E2&group.limit=25`,
			ocpApimSubscriptionKey: 'a61a00f528344ce29179af297ccbbea8',
			partNumber: [code],
			type: 'crossRef'
		}
	};

	try {
		return getJsonToProducts<ResponseSchema>(
			'baldwin',
			axiosReqConfig,
			{
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (
						let i = 0;
						i <
						resData.grouped[
							`compPartId_s:("${formattedCode}" OR ${formattedCode}* OR *${formattedCode}*)`
						].doclist.docs.length;
						i++
					) {
						const row =
							resData.grouped[
								`compPartId_s:("${formattedCode}" OR ${formattedCode}* OR *${formattedCode}*)`
							].doclist.docs[i];
						products.push({
							manufacturer: row.manufacturer_s,
							manufacturer_code: row.partNumber_s,
							source_reference_code: row.code_si,
							detailsUrl: `https://ph.baldwinfilters.com/baldwin/en/${row.psURLKeyword_si}/${row.urlKeyword_si}`
						});
					}
					return products;
				}
			},
			config,
			page
		);
	} catch (err) {
		console.error('baldwin error', err);
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

export const getNextProducts: GetNextProducts = () => null;
