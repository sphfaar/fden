import type { GetProducts, GetNextProducts } from '../types';
import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { getHtmlToProducts } from '#lib/product_sources/getHtmlToProductsData.server.js';
import { headers } from '#lib/product_sources/constants.js';

const FBN_ORIGIN = 'https://www.fbn.it';
const FBN_REFERER = `${FBN_ORIGIN}/ita/cross-reference`;
const FBN_LOGIN_URL = `${FBN_ORIGIN}/Apps/WebObjects/FBN.woa/wa/CRAction/login`;
const FBN_SEARCH_URL = `${FBN_ORIGIN}/Apps/WebObjects/FBN.woa/1/wa/CRAction/search`;
const WOSID_PATTERN = /^[\w-]{8,128}$/;

function cookieValue(setCookies: string[], name: string): string | undefined {
	let found: string | undefined;
	for (const cookie of setCookies) {
		const pair = cookie.split(';', 1)[0] ?? '';
		const eq = pair.indexOf('=');
		if (eq === -1) continue;
		if (pair.slice(0, eq).trim() === name) found = pair.slice(eq + 1).trim();
	}
	return found;
}

function wosidFromHtml(html: string): string | undefined {
	const tag = html.match(/<input\b[^>]*\bid="wosid"[^>]*>/i)?.[0];
	const value = tag?.match(/\bvalue="([^"]*)"/)?.[1];
	return value && WOSID_PATTERN.test(value) ? value : undefined;
}

function fbnHeaders(cookie?: string): Record<string, string> {
	return {
		...headers,
		Accept: 'text/html, */*; q=0.01',
		'Accept-Language': 'en-US,en;q=0.5',
		Origin: FBN_ORIGIN,
		Referer: FBN_REFERER,
		'X-PJAX': 'true',
		'X-PJAX-Container': '#cr-container',
		'X-Requested-With': 'XMLHttpRequest',
		...(cookie ? { Cookie: cookie } : {})
	};
}

export async function getSession(
	username: string,
	password: string
): Promise<string | ActionFailure<{ authError: boolean }> | null> {
	try {
		const page = await fetch(FBN_REFERER, { headers: fbnHeaders() });
		if (!page.ok) return fail(400, { authError: true });
		const setCookies = page.headers.getSetCookie();
		await page.body?.cancel();
		const anon = cookieValue(setCookies, 'wosid');
		const woinst = cookieValue(setCookies, 'woinst');
		if (!anon || !WOSID_PATTERN.test(anon)) error(500, 'FBN login failed');
		const sessionCookie = `wosid=${anon}; woinst=${woinst && /^\d+$/.test(woinst) ? woinst : '1'}`;

		const body = new FormData();
		body.set('email', username);
		body.set('password', password);
		body.set('lang', 'ita');

		const response = await fetch(FBN_LOGIN_URL, {
			method: 'POST',
			headers: fbnHeaders(sessionCookie),
			body
		});
		const html = await response.text();
		if (!response.ok || html.includes('Login fallito')) return fail(400, { authError: true });

		const wosid = wosidFromHtml(html) ?? cookieValue(response.headers.getSetCookie(), 'wosid');
		if (!wosid || !WOSID_PATTERN.test(wosid)) return fail(400, { authError: true });
		return wosid;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('FBN login failed', err);
		error(500, 'FBN login failed');
	}
}

export const getProducts: GetProducts = async (code, _maxItems, config, page = 1, opts) => {
	const sessionToken = opts?.sessionToken;
	if (!sessionToken || !WOSID_PATTERN.test(sessionToken)) error(400, 'FBN session token not found');

	const axiosReqConfig = {
		method: 'GET',
		url: FBN_SEARCH_URL,
		params: {
			batchIndex: page,
			originale: code,
			marca: '',
			fbn: ''
		},
		headers: fbnHeaders(`wosid=${sessionToken}; woinst=1`)
	};
	try {
		return getHtmlToProducts(
			'fbn',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('.table > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];
					for (let i = 0; i < tableRows.length; i++) {
						products.push({
							manufacturer:
								tableRows[i].querySelector('td:nth-child(1)')?.textContent?.trim() ?? '',
							manufacturer_code:
								tableRows[i].querySelector('td:nth-child(2)')?.textContent?.trim() ?? '',
							source_reference_code:
								tableRows[i].querySelector('td:nth-child(3)')?.textContent?.trim() ?? ''
						});
					}
					return products;
				},
				nPages: (document) =>
					Number(
						document.querySelector("[name='batchIndex'] option:last-child")?.getAttribute('value')
					),
				totalItems: (_document, pageNumber, nProducts, nPages) =>
					nProducts && pageNumber && nPages
						? pageNumber < nPages
							? String((nPages - 1) * 9) + '+'
							: nPages * nProducts
						: undefined
			},
			config,
			page,
			9
		);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('FBN search failed', err);
		error(500, 'FBN error');
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page = 1, opts) =>
	await getProducts(code, maxItems, config, page + 1, opts);
