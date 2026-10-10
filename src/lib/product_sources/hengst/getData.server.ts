import type { GetNextProducts, GetProducts } from '../types';
import { catalogHttpsUrl } from '#lib/safeCatalogUrl.js';
import { headers } from '#lib/product_sources/constants.js';
import { getHtmlToProducts } from '../getHtmlToProductsData.server';
import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';

const CATALOG_ORIGIN = 'https://catalog.hengst.com';
// Hits per page only applies 10, 20, or 50. Any other limit is ignored and the body is 50 rows.
const CATALOG_PAGE_SIZES = [10, 20, 50] as const;
const PLACEHOLDER_IMAGE = /\/images\/no-pic\.jpg(?:\?|$)/iu;

function catalogPageSize(maxItems: number): number {
	let size: number = CATALOG_PAGE_SIZES[0];
	for (const candidate of CATALOG_PAGE_SIZES) {
		if (candidate <= maxItems) size = candidate;
	}
	return size;
}

function cleanText(value: string | null | undefined): string {
	return value?.replaceAll(/\s+/gu, ' ').trim() ?? '';
}

// `var resultCount = '100'`, or `''` when the catalog says no entries were found.
function resultCount(document: Document): number | undefined {
	for (const script of document.querySelectorAll('script')) {
		const match = /resultCount\s*=\s*'([^']*)'/.exec(script.textContent ?? '');
		if (!match) continue;
		if (match[1] === '') return 0;
		const count = Number(match[1]);
		return Number.isFinite(count) ? count : undefined;
	}
	return undefined;
}

function selectedPageSize(document: Document, fallback: number): number {
	const selected = document.querySelector('select.result-table__select-limit option[selected]');
	const size = Number(selected?.getAttribute('value'));
	return Number.isSafeInteger(size) && size > 0 ? size : fallback;
}

function cellText(item: Element | undefined): string {
	const columns = item?.querySelectorAll(':scope > .result-table__table-mobile-row__item-col');
	return cleanText(columns?.[1]?.textContent);
}

function hengstType(link: Element | undefined): string {
	if (!link) return '';
	const clone = link.cloneNode(true) as Element;
	clone.querySelector(':scope > .result-table__tooltip')?.remove();
	clone.querySelector(':scope > i')?.remove();
	return cleanText(clone.textContent);
}

function rowThumbnail(row: Element): string[] | undefined {
	const imageUrl = row.querySelector(':scope .result-table__tooltip img')?.getAttribute('src');
	if (!imageUrl || PLACEHOLDER_IMAGE.test(imageUrl)) return undefined;
	const url = catalogHttpsUrl(imageUrl, `${CATALOG_ORIGIN}/`);
	return url ? [url] : undefined;
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const pageSize = catalogPageSize(maxItems);
	const axiosRequestConfig = {
		method: 'GET',
		url: `${CATALOG_ORIGIN}/en/online-catalog/search-results/ajax.api`,
		params: {
			catalog: 'it',
			'request[mvc][vendor]': 'UiHengst',
			'request[mvc][extensionName]': 'UiHengst',
			'request[mvc][pluginName]': 'Uihengst',
			'request[mvc][controller]': 'Hengst',
			'request[mvc][action]': 'searchResultTableAjax',
			'request[arguments][searchType]': 'freetext',
			'request[arguments][freetext]': code,
			'request[arguments][resultTable]': 'ref',
			'request[arguments][page]': page,
			'request[arguments][limit]': pageSize,
			'request[arguments][sort]': 'type',
			'request[arguments][sort_order]': 'asc'
		},
		headers: {
			...headers,
			cookie: 'catalog=it',
			Host: 'catalog.hengst.com',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			Referer: `${CATALOG_ORIGIN}/en/online-catalog/search/?catalog=it`,
			Connection: 'keep-alive',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-Fetch-User': '?1',
			Priority: 'u=0, i',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
	};
	try {
		return getHtmlToProducts(
			'hengst',
			axiosRequestConfig,
			{
				tableRows: (document) => document.querySelectorAll('.result-table__table-mobile-row'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (const row of tableRows) {
						const items = row.querySelectorAll(':scope > .result-table__table-mobile-row__item');
						// Item 1 is labeled "Hengst type". The value is the manufacturer.
						const link = row.querySelector(':scope .result-table__linkbtn');
						const product: Product = {
							manufacturer: cellText(items[1]),
							manufacturer_code: cellText(items[0]),
							source_reference_code: hengstType(link ?? undefined)
						};
						const detailsUrl = catalogHttpsUrl(link?.getAttribute('href'), `${CATALOG_ORIGIN}/`);
						if (detailsUrl) product.detailsUrl = detailsUrl;
						const thumbnails = rowThumbnail(row);
						if (thumbnails) product.thumbnails = thumbnails;
						products.push(product);
					}
					return products;
				},
				// Paging links are a window. Link index 2 is not the last page past two pages.
				nPages: (document) => {
					const total = resultCount(document);
					return total ? Math.ceil(total / selectedPageSize(document, pageSize)) : 1;
				},
				totalItems: (document) => resultCount(document)
			},
			config,
			page,
			pageSize
		);
	} catch (error) {
		failSourceRequest(error, 'Hengst error');
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page = 1) =>
	await getProducts(code, maxItems, config, page + 1);
