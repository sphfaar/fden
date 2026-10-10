import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './response-schema';
import { getJsonToProducts } from '../get-json-to-products-data.server';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const SEARCH_ORIGIN = 'https://crossref.search.windows.net';
const PRODUCT_ORIGIN = 'https://ph.parker.com';
const PAGE_CAP = 100;
const NON_CROSSOVER = /possible alternatives|no CRossover/i;

type ParkerRow = ResponseSchema['value'][number];

// Published product pages are https://ph.parker.com/{country}/en/{URLKeywords}.
// Prefer the US catalog when that locale is in UrlCountryCode.
function detailsUrl(row: ParkerRow): string | undefined {
	const keywords = row.URLKeywords?.trim();
	if (!keywords) return undefined;
	if (/^https?:\/\//i.test(keywords)) return catalogHttpsUrl(keywords);

	const countries = (row.UrlCountryCode ?? '')
		.split(',')
		.map((country) => country.trim().toLowerCase())
		.filter((country) => country.length > 0);
	const country =
		(countries.includes('us') ? 'us' : undefined) ??
		countries.find((code) => /^[a-z]{2}$/.test(code)) ??
		countries[0];
	if (!country || !/^[a-z0-9-]+$/.test(country)) return undefined;

	const path = keywords
		.replace(/^\/+/, '')
		.split('/')
		.filter((segment) => segment.length > 0)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return path ? catalogHttpsUrl(`${PRODUCT_ORIGIN}/${country}/en/${path}`) : undefined;
}

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function toProduct(row: ParkerRow): Product {
	const description = text(row.Description);
	const category = text(row.Type);
	const url = detailsUrl(row);
	return {
		manufacturer: row.FromManufacturerName,
		manufacturer_code: row.FromPartNumber,
		source_reference_code: row.ToPartNumber,
		...(description && { description }),
		...(category && { category }),
		...(url && { detailsUrl: url })
	};
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1) => {
	const nItems = Math.min(maxItems, PAGE_CAP);
	const safePage = page > 0 ? page : 1;
	const skip = nItems * (safePage - 1);
	const codeEncoded = encodeURIComponent(code);
	const axiosReqConfig = {
		method: 'GET',
		url: `${SEARCH_ORIGIN}/indexes/partcrossreference-prod-search-view-index/docs?api-version=2019-05-06&facet=FromManufacturerName,count%3A1000&facet=Type,count%3A1000&facet=DivisionName,count%3A1000&search=${codeEncoded}%20and%20CleanedFromPartNumber%3A%2F(.*)${codeEncoded}(.*)%2F&%24filter=(DivisionName%20ne%20'Total%20Filtration%20Services')%20and%20Published%20eq%20'YES'&%24top=${nItems}&%24skip=${skip}&queryType=full&%24count=true`,
		headers: {
			...headers,
			'api-key': 'C57B3E22FF9AD549129AB375C6F2F93A'
		}
	};
	try {
		return await getJsonToProducts<ResponseSchema>(
			'parker',
			axiosReqConfig,
			{
				// ToPartNumber is not filterable, so non-crossover rows are dropped here.
				// @odata.count still includes them. pages stops load-more; maxItemsPagination
				// stays unset because that unfiltered total would offer a page past the last one.
				rowsIterator: (resData) => {
					const products: Product[] = [];
					for (let i = 0; i < resData.value.length; i++) {
						const row = resData.value[i];
						if (!NON_CROSSOVER.test(row.ToPartNumber)) products.push(toProduct(row));
					}
					return products;
				},
				nPages: (resData) => {
					const count = resData['@odata.count'];
					return !count || count < 1 ? 0 : Math.ceil(count / nItems);
				},
				totalItems: (resData) => resData['@odata.count']
			},
			config,
			safePage
		);
	} catch (err) {
		console.error('Parker error', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = (code, maxItems, config, page) =>
	getProducts(code, maxItems, config, page + 1);
