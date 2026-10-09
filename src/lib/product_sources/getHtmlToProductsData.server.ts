import type { GetProductsConfig } from './types';
import type { AxiosRequestConfig } from 'axios';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import axios from '#lib/product_sources/axios.server.js';
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
		const reqStart = config?.showPerfReqProxyToSource ? Date.now() : null;
		const response = await axios.request(axiosReqConfig);
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
		const reqEnd = config?.showPerfReqProxyToSource ? Date.now() : null;

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
				totalItems: totalItems,
				page: page,
				pages: nPages,
				maxItemsPagination: pagination,
				performanceTimings: {
					proxyToSource: reqEnd && reqStart ? reqEnd - reqStart : undefined
				}
			},
			products: products
		};
	} catch (err) {
		failSourceRequest(err, `${sourceID} error`);
	}
}
