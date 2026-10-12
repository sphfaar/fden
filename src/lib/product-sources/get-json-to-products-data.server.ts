import type { AxiosRequestConfig } from 'axios';
import type { GetProductsConfig } from './types';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import axios from '#lib/product-sources/axios.server.js';

interface ParsingFunctions<T> {
	rowsIterator: (resData: T) => Product[];
	nPages?: (resData: T) => number;
	pagination?: number | ((resData: T) => number | undefined);
	totalItems?: (resData: T) => number | string | undefined;
}
export async function getJsonToProducts<T>(
	sourceID: string,
	axiosReqConfig: AxiosRequestConfig,
	parsingFunctions: ParsingFunctions<T>,
	config?: GetProductsConfig,
	page?: number
): Promise<ProductsData> {
	try {
		const reqStart = config?.showPerfReqProxyToSource ? Date.now() : undefined;
		// Axios rejects non-2xx before this status check. Accept every status unless the source set its own check.
		const response = await axios.request({
			...axiosReqConfig,
			validateStatus: axiosReqConfig.validateStatus ?? (() => true)
		});
		if (response.status >= 400) {
			return {
				meta: {
					status: response.status,
					currentItemsDisplayed: 0,
					page: 0
				},
				products: []
			};
		}
		const responseData = response.data;
		const reqEnd = config?.showPerfReqProxyToSource ? Date.now() : undefined;
		const products: Product[] = parsingFunctions.rowsIterator(responseData);
		return {
			meta: {
				status: response.status,
				currentItemsDisplayed: products.length,
				totalItems: parsingFunctions.totalItems
					? parsingFunctions.totalItems(responseData)
					: undefined,
				page: page ?? 1,
				pages: parsingFunctions.nPages ? parsingFunctions.nPages(responseData) : undefined,
				maxItemsPagination:
					typeof parsingFunctions.pagination === 'number'
						? parsingFunctions.pagination
						: parsingFunctions.pagination
							? parsingFunctions.pagination(responseData)
							: undefined,
				performanceTimings: {
					proxyToSource: reqEnd && reqStart ? reqEnd - reqStart : undefined
				}
			},
			products
		};
	} catch (err) {
		failSourceRequest(err, `${sourceID} error`);
	}
}
