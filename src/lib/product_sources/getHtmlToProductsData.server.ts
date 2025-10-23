import { error } from '@sveltejs/kit';
import type { GetProductsConfig } from './types';
import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';
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
	) => number | string | null;
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
					totalItems: null,
					page: 0,
					maxItemsPagination: null
				},
				products: []
			};
		}

		const html = await response.data;
		const reqEnd = config?.showPerfReqProxyToSource ? Date.now() : null;

		const { document } = parseHTML(
			parsingFunctions.documentToHtml ? parsingFunctions.documentToHtml(html) : html
		);
		const tableRows = parsingFunctions.tableRows(document);
		const nPages: number | null = parsingFunctions.nPages
			? parsingFunctions.nPages(document)
			: null;
		const products: Product[] = parsingFunctions.rowsIterator(tableRows);
		const totalItems: number | string | null = parsingFunctions.totalItems
			? parsingFunctions.totalItems(document, page, products.length, nPages ?? undefined)
			: null;
		return {
			meta: {
				status: response.status,
				currentItemsDisplayed: products.length,
				totalItems: totalItems,
				page: page,
				pages: nPages,
				maxItemsPagination: pagination ?? null,
				performanceTimings: {
					proxyToSource: reqEnd && reqStart ? reqEnd - reqStart : null
				}
			},
			products: products
		};
	} catch (err) {
		error(500, `${sourceID} error: ${err}`);
	}
}
