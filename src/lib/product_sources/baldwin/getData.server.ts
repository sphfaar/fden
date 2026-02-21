import { headers } from '$lib/product_sources/constants';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import type { GetNextProducts, GetProducts } from '../types';
import type ResponseSchema from './ResponseSchema';

// NOTE: Helper function to add a delay (ms) between requests to avoid rate limiting, which can cause 403 after multiple queries in a short time.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getProducts: GetProducts = async (
	code: string,
	maxItems,
	config,
	page = 1,
	opts = { retries: 2 }
) => {
	const nItems = Math.min(maxItems, Infinity);
	// NOTE: Added retries param (default 2) to handle intermittent 403 by refreshing cookies.
	const formattedCode = code.replaceAll(/[^\w]/g, '').toUpperCase();
	// NOTE: Referer dynamic to match the code/query, as hardcoded values can cause mismatches leading to 403 or invalid sessions.
	const refererUrl = `https://www.baldwinfilters.com/us/en/cross-reference-result-page.html?partNo1=${encodeURIComponent(code)}`;

	// NOTE: cookie jar to persist session cookies across requests, preventing 403 errors from missing Akamai bot management cookies (e.g., ak_bmsc).
	const jar = new CookieJar();
	const client = wrapper(
		axios.create({
			baseURL: 'https://www.baldwinfilters.com',
			jar,
			withCredentials: true, // NOTE: Enable credentials to send/receive cookies automatically.
			headers: {
				...headers,
				Accept: '*/*',
				'Accept-Encoding': 'gzip, deflate, br, zstd',
				'Accept-Language': 'en-US,en;q=0.5',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'Content-Type': 'application/json',
				Origin: 'https://www.baldwinfilters.com',
				Pragma: 'no-cache',
				Priority: 'u=4',
				Referer: refererUrl, // NOTE: Use dynamic Referer for all requests to avoid security checks failing.
				'Sec-Fetch-Dest': 'empty',
				'Sec-Fetch-Mode': 'cors',
				'Sec-Fetch-Site': 'same-origin',
				'Sec-GPC': '1',
				TE: 'trailers'
			},
			timeout: 10000 // 10s timeout to prevent hanging on slow responses.
		})
	);

	try {
		// NOTE: Add a small delay before requests to simulate human behavior and avoid rate limits (e.g., 403 after "some time" from too many fast queries).
		await delay(600); // Adjust based on testing; e.g., 1000ms for production.

		// NOTE: Perform an initial GET to the Referer page to establish a session and fetch required cookies (e.g., ApplicationGatewayAffinity, ak_bmsc). This mimics browser behavior and bypasses bot detection.
		// If Akamai requires JS (rarely in initial GET), this may fail—consider a headless browser like Puppeteer (but not in Cloudflare Workers; use external service).
		await client.get(refererUrl.replace('https://www.baldwinfilters.com', '')); // Relative path for baseURL.

		// NOTE: Perform the POST with the same client; cookies will be included automatically, reducing 403 risks.
		const response = await client.post(
			'/content/baldwin-filters/us/en/cross-reference-result-page.data.json',
			{
				url: `https://api.parker.com/prod/baldwinsearch/BaldwinECatalog/select?fq=coreName_s:BaldwinCrossRefData&=&wt=json&indent=true&group=true&group.offset=0&group.query=compPartId_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20OR%20*${formattedCode}*)&q=compPartId_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20OR%20*${formattedCode}*%20)%5E1%20OR%20partNumber_s:(%22${formattedCode}%22%20OR%20${formattedCode}*%20)%5E2&group.limit=${isFinite(nItems) ? nItems : -1}`,
				ocpApimSubscriptionKey: 'a61a00f528344ce29179af297ccbbea8',
				partNumber: [code],
				type: 'crossRef'
			}
		);

		const resData = response.data as ResponseSchema;
		const products: Product[] = [];
		const groupKey = `compPartId_s:("${formattedCode}" OR ${formattedCode}* OR *${formattedCode}*)`;
		const docs = resData.grouped?.[groupKey]?.doclist?.docs ?? []; // NOTE: Safely access nested properties to avoid undefined errors if response structure varies unexpectedly.
		for (
			let i = 0;
			i <
			resData.grouped[
				`compPartId_s:("${formattedCode}" OR ${formattedCode}* OR *${formattedCode}*)`
			].doclist.docs.length;
			i++
		) {
			const row = docs[i];
			const urlKeyword = row.urlKeyword_si;
			const urlKeyword2 = row.psURLKeyword_si;
			const detailsUrl = urlKeyword
				? `https://ph.baldwinfilters.com/baldwin/en/${urlKeyword}`
				: undefined;

			const thumbnailUrlProdString = convertProductString(urlKeyword2);
			const thumbnailUrl = thumbnailUrlProdString
				? `https://www.parker.com/content/dam/Parker-com/Online/Product-Images/Engine-Mobile-Aftermarket-Division/zoom_1000x1000/${thumbnailUrlProdString}_${row.code_si}_zm.jpg`
				: undefined;
			products.push({
				manufacturer: row.manufacturer_s,
				manufacturer_code: row.partNumber_s,
				source_reference_code: row.code_si,
				detailsUrl,
				thumbnails: thumbnailUrl ? [thumbnailUrl] : undefined
			});
		}

		return {
			meta: {
				status: response.status,
				currentItemsDisplayed: products.length,
				totalItems:
					resData.grouped[
						`compPartId_s:("${formattedCode}" OR ${formattedCode}* OR *${formattedCode}*)`
					].doclist.numFound, // NOTE: Assuming this field exists for total; adjust if needed based on actual response.
				maxItemsPagination: null, // From group.limit.
				page
			},
			products
		};
	} catch (err) {
		console.error('baldwin error', err);
		// NOTE: On 403, retry by recursing (refresh cookies via new GET). This handles expiration "after some time". Limit retries to avoid infinite loops.
		if (opts.retries && opts.retries > 0) {
			console.warn(`possible 403 detected; retrying (${opts.retries} left)...`);
			await delay(2000); // Longer delay on retry to cool off.
			return getProducts(code, maxItems, config, page, { retries: opts.retries - 1 });
		}
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

// Function to convert the input string to the format of images urls
function convertProductString(input?: string): string | null {
	if (!input) {
		console.warn(
			'convertProductString called with missing/empty input; returning empty string'
		);
		return null;
	}
	// NOTE: Remove any spaces from the input to handle potential whitespace in URLs or data (e.g., from API variations); uses regex for global replacement
	input = input.replace(/\s/g, '');
	// NOTE: Split the input by '/' and skip the first segment ('product-list' or 'product').
	const segments = input.split('/').slice(1);

	// Basic validation: Ensure there is at least one relevant segment (handles new format with 1 segment or old with 2).
	if (segments.length < 1) {
		return null;
	}

	const part1 = segments[0];
	// Process part1: Split by '-', capitalize each word, and join with '_'.
	const processedPart1 = part1
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
		.join('_')
		.replace('Baldwin_In_', 'Baldwin_In-');

	let processedPart2 = '';
	if (segments.length > 1) {
		const part2 = segments[1];
		// Process part2 (if present in old format): Uppercase the entire string, as per current code (e.g., "p203" -> "P203").
		processedPart2 = '_' + part2.toUpperCase();
	}

	// Join the processed parts (appends nothing if no part2 in new format).
	return processedPart1 + processedPart2;
}
