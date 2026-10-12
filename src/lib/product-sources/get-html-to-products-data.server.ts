import type { GetProductsConfig } from './types';
import type { AxiosRequestConfig } from 'axios';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import axios from '#lib/product-sources/axios.server.js';
import { parseHTML } from 'linkedom';

interface ParsingFunctions<T> {
	tableRows: (document: Document) => HTMLCollectionOf<Element> | NodeListOf<Element>;
	rowsIterator: (tableRows: HTMLCollectionOf<Element> | NodeListOf<Element>) => Product[];
	nPages?: (document: Document) => number;
	totalItems?: (
		document: Document,
		page?: number,
		nProducts?: number,
		nPages?: number
	) => number | string | undefined;
	documentToHtml?: (resData: T) => string;
}

export async function getHtmlToProducts<T>(
	sourceID: string,
	axiosReqConfig: AxiosRequestConfig,
	parsingFunctions: ParsingFunctions<T>,
	config?: GetProductsConfig,
	page = 1,
	pagination?: number
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

		const html = response.data;
		const reqEnd = config?.showPerfReqProxyToSource ? Date.now() : undefined;

		const { document } = parseHTML(
			parsingFunctions.documentToHtml ? parsingFunctions.documentToHtml(html) : html
		);
		const tableRows = parsingFunctions.tableRows(document);
		const nPages: number | undefined = parsingFunctions.nPages
			? parsingFunctions.nPages(document)
			: undefined;
		const products: Product[] = parsingFunctions.rowsIterator(tableRows);
		const totalItems: number | string | undefined = parsingFunctions.totalItems
			? parsingFunctions.totalItems(document, page, products.length, nPages)
			: undefined;
		return {
			meta: {
				status: response.status,
				currentItemsDisplayed: products.length,
				totalItems,
				page,
				pages: nPages,
				maxItemsPagination: pagination,
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
