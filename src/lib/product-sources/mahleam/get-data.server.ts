import type { GetNextProducts, GetProducts } from '../types';
import type MahleamSchema from './response-schema';
import type {
	MahleamArticle,
	MahleamArticleText,
	MahleamCriterion,
	MahleamSearchMatch
} from './response-schema';
import { getJsonToProducts } from '../get-json-to-products-data.server';
import { headers } from '#lib/product-sources/constants.js';
import { catalogHttpsUrl } from '#lib/safe-catalog-url.js';

const ENDPOINT =
	'https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint';
const CATALOG_ORIGIN = 'https://web.tecalliance.net';
const PAGE_CAP = 100;
const HEIGHT = 209;
const DIAMETER = 200;
const OUTER_DIAMETER = 497;
const INNER_DIAMETER = 496;
const INNER_DIAMETER_1 = 995;
const THREAD_SIZE = 289;
const PACK_LENGTH = 1620;
const PACK_WIDTH = 1621;
const PACK_HEIGHT = 1622;
const FILTER_TYPE = 826;
const MATERIAL = 468;

const catalogHeaders = {
	...headers,
	Host: 'webservice.tecalliance.services',
	Accept: 'application/json, text/plain, */*',
	'Accept-Language': 'en,en-US;q=0.7,it;q=0.3',
	Origin: CATALOG_ORIGIN,
	'Sec-GPC': '1',
	Connection: 'keep-alive',
	'Sec-Fetch-Dest': 'empty',
	'Sec-Fetch-Mode': 'no-cors',
	'Sec-Fetch-Site': 'cross-site',
	TE: 'trailers',
	'Content-Type': 'application/json',
	Referer: `${CATALOG_ORIGIN}/`,
	Priority: 'u=4',
	Pragma: 'no-cache',
	'Cache-Control': 'no-cache'
};

function text(value: string | null | undefined): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function criteriaById(article: MahleamArticle): Map<number, MahleamCriterion> {
	const map = new Map<number, MahleamCriterion>();
	const criteria = [
		...(article.articleCriteria ?? []),
		...(article.articleLogisticsCriteria ?? [])
	];
	for (const criterion of criteria) {
		if (typeof criterion.criteriaId === 'number' && !map.has(criterion.criteriaId)) {
			map.set(criterion.criteriaId, criterion);
		}
	}
	return map;
}

function measure(criterion: MahleamCriterion | undefined, unit: 'mm' | 'cm'): number | undefined {
	if (!criterion || criterion.criteriaUnitDescription !== unit) return undefined;
	const raw = text(criterion.formattedValue)?.replace(',', '.');
	if (!raw) return undefined;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return undefined;
	// Packaging criteria are centimeters. Other catalogs store packaging in millimeters.
	return unit === 'cm' ? Math.round(value * 10_000) / 1000 : value;
}

function matchText(match: MahleamSearchMatch | undefined): string | undefined {
	return text(match?.match);
}

// The searched part is the first OE number this query hit, as the catalog prints it.
// An article-number or trade-number hit is used only when no OE number matched.
function searchedPart(article: MahleamArticle): {
	manufacturer: string;
	manufacturer_code: string;
} {
	const matches = article.searchQueryMatches ?? [];
	const oe = matches.find(
		(match) => match.matchType === 'OENumber' && matchText(match) && text(match.mfrName)
	);
	if (oe) return { manufacturer: text(oe.mfrName) ?? '', manufacturer_code: matchText(oe) ?? '' };
	const comparable = matches.find(
		(match) => match.matchType === 'ComparableNumber' && matchText(match) && text(match.mfrName)
	);
	if (comparable) {
		return {
			manufacturer: text(comparable.mfrName) ?? '',
			manufacturer_code: matchText(comparable) ?? ''
		};
	}
	const ownBrand = text(article.mfrName) ?? '';
	const trade = matches.find((match) => match.matchType === 'TradeNumber' && matchText(match));
	if (trade) return { manufacturer: ownBrand, manufacturer_code: matchText(trade) ?? '' };
	const own = matches.find((match) => match.matchType === 'ArticleNumber' && matchText(match));
	if (own) return { manufacturer: ownBrand, manufacturer_code: matchText(own) ?? '' };
	const oem = (article.oemNumbers ?? []).find(
		(number) => number.matchesSearchQuery && text(number.articleNumber) && text(number.mfrName)
	);
	if (oem) {
		return {
			manufacturer: text(oem.mfrName) ?? '',
			manufacturer_code: text(oem.articleNumber) ?? ''
		};
	}
	return { manufacturer: ownBrand, manufacturer_code: text(article.articleNumber) ?? '' };
}

function articleCategory(article: MahleamArticle): string | undefined {
	const names: string[] = [];
	const generics = article.genericArticles ?? [];
	for (const generic of generics) {
		const name = text(generic.genericArticleDescription);
		if (name && !names.includes(name)) names.push(name);
	}
	return names.length > 0 ? names.join(' | ') : undefined;
}

function articleDescription(
	article: MahleamArticle,
	criteria: Map<number, MahleamCriterion>
): string | undefined {
	return (
		text(article.misc?.additionalDescription) ?? text(criteria.get(FILTER_TYPE)?.formattedValue)
	);
}

function articleLongDescription(article: MahleamArticle): string | undefined {
	const blocks = article.articleText;
	if (typeof blocks === 'string') return text(blocks);
	if (!Array.isArray(blocks) || blocks.length === 0) return undefined;
	const parts: string[] = [];
	for (const block of blocks) {
		const body = textLines(block);
		if (!body) continue;
		const label = text(block.informationTypeDescription);
		if (label && (label !== 'General Information' || blocks.length > 1)) {
			parts.push(`${label}\n${body}`);
		} else {
			parts.push(body);
		}
	}
	return parts.length > 0 ? parts.join('\n\n') : undefined;
}

function textLines(block: MahleamArticleText): string | undefined {
	const lines = (block.text ?? []).map((line) => text(line)).filter((line) => line !== undefined);
	return lines.length > 0 ? lines.join('\n') : undefined;
}

function articleDetailsUrl(article: MahleamArticle): string | undefined {
	const number = text(article.articleNumber);
	if (!number || typeof article.dataSupplierId !== 'number') return undefined;
	return catalogHttpsUrl(
		`${CATALOG_ORIGIN}/mahle-catalog/en/parts/${article.dataSupplierId}/${encodeURIComponent(number)}/detail`
	);
}

function articleThumbnails(article: MahleamArticle): string[] | undefined {
	const images = [...(article.images ?? [])].toSorted((left, right) => {
		const leftPicture = left.headerDescription === 'Picture' ? 0 : 1;
		const rightPicture = right.headerDescription === 'Picture' ? 0 : 1;
		return leftPicture === rightPicture
			? (left.sortNumber ?? 0) - (right.sortNumber ?? 0)
			: leftPicture - rightPicture;
	});
	const urls: string[] = [];
	for (const image of images) {
		const url = catalogHttpsUrl(image.imageURL800);
		if (url && !urls.includes(url)) urls.push(url);
	}
	return urls.length > 0 ? urls : undefined;
}

function articleDimensions(
	criteria: Map<number, MahleamCriterion>
): Product['dimensions'] | undefined {
	const dimensions: NonNullable<Product['dimensions']> = {};
	const externalDiameter =
		measure(criteria.get(OUTER_DIAMETER), 'mm') ?? measure(criteria.get(DIAMETER), 'mm');
	const internalDiameter =
		measure(criteria.get(INNER_DIAMETER), 'mm') ?? measure(criteria.get(INNER_DIAMETER_1), 'mm');
	const height = measure(criteria.get(HEIGHT), 'mm');
	const threadSize = text(criteria.get(THREAD_SIZE)?.formattedValue);
	if (externalDiameter !== undefined) dimensions.externalDiameter = externalDiameter;
	if (internalDiameter !== undefined) dimensions.internalDiameter = internalDiameter;
	if (height !== undefined) dimensions.height = height;
	if (threadSize) dimensions.threadSize = threadSize;
	return externalDiameter !== undefined ||
		internalDiameter !== undefined ||
		height !== undefined ||
		threadSize
		? dimensions
		: undefined;
}

function articleSpecs(
	criteria: Map<number, MahleamCriterion>,
	category: string | undefined
): Product['specs'] | undefined {
	if (!category || !/filter/i.test(category)) return undefined;
	const mediaType = text(criteria.get(MATERIAL)?.formattedValue);
	return mediaType ? { mediaType } : undefined;
}

function articlePackaging(
	criteria: Map<number, MahleamCriterion>
): Product['packaging'] | undefined {
	const width = measure(criteria.get(PACK_WIDTH), 'cm');
	const length = measure(criteria.get(PACK_LENGTH), 'cm');
	const height = measure(criteria.get(PACK_HEIGHT), 'cm');
	if (width === undefined || length === undefined || height === undefined) return undefined;
	return { width, length, height };
}

function toProduct(article: MahleamArticle): Product {
	const identity = searchedPart(article);
	const criteria = criteriaById(article);
	const category = articleCategory(article);
	const product: Product = {
		manufacturer: identity.manufacturer,
		manufacturer_code: identity.manufacturer_code,
		source_reference_code: text(article.articleNumber) ?? ''
	};
	const detailsUrl = articleDetailsUrl(article);
	if (detailsUrl) product.detailsUrl = detailsUrl;
	const description = articleDescription(article, criteria);
	if (description) product.description = description;
	const longDescription = articleLongDescription(article);
	if (longDescription) product.longDescription = longDescription;
	if (category) product.category = category;
	const thumbnails = articleThumbnails(article);
	if (thumbnails) product.thumbnails = thumbnails;
	const dimensions = articleDimensions(criteria);
	if (dimensions) product.dimensions = dimensions;
	const specs = articleSpecs(criteria, category);
	if (specs) product.specs = specs;
	const packaging = articlePackaging(criteria);
	if (packaging) product.packaging = packaging;
	return product;
}

function requestBody(code: string, page: number, perPage: number) {
	return {
		getArticles: {
			applyDqmRules: true,
			articleCountry: 'DE',
			provider: 22620,
			lang: 'en',
			searchQuery: code,
			searchMatchType: 'prefix_or_suffix',
			searchType: 10,
			page,
			perPage,
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
			linkagesPerPage: perPage,
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
	};
}

export const getProducts: GetProducts = async (code, maxItems, config, page: number = 1) => {
	const nItems = Math.min(maxItems, PAGE_CAP);
	const safePage = page > 0 ? page : 1;

	try {
		return await getJsonToProducts<MahleamSchema>(
			'mahleam',
			{
				method: 'POST',
				url: ENDPOINT,
				headers: catalogHeaders,
				data: requestBody(code, safePage, nItems)
			},
			{
				rowsIterator: (resData) => {
					if (typeof resData.status === 'number' && resData.status >= 400) {
						throw new Error(`mahleam status ${resData.status}`);
					}
					return (resData.articles ?? []).map(toProduct);
				},
				nPages: (resData) => resData.maxAllowedPage ?? 0,
				pagination: nItems,
				totalItems: (resData) => resData.totalMatchingArticles
			},
			config,
			safePage
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
