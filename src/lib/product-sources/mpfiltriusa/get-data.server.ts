import type { GetNextProducts, GetProducts } from '../types';
import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { failSourceRequest } from '#lib/product-sources/source-error.server.js';
import { getHtmlToProducts } from '../get-html-to-products-data.server';
import { headers } from '#lib/product-sources/constants.js';

const ORIGIN = 'https://www.mpfiltri.com';
const INTERCHANGE_URL = `${ORIGIN}/interchange-filter-elements/`;
const LOGGED_IN_NAME = /^wordpress_logged_in_[A-Za-z0-9]+$/;
const SECURE_NAME = /^wordpress_sec_[A-Za-z0-9]+$/;
const LOGIN_PATH = /\/(my-account|il-mio-account|mon-compte|mein-konto|minha-conta)\/?$/i;

export function sessionCookieHeader(raw: string): string | undefined {
	const text = raw.trim().replace(/^cookie:\s*/i, '');
	if (!text || text.length > 4096) return undefined;

	const pairs: string[] = [];
	for (const part of text.split(/[;\n]+/)) {
		const piece = part.trim();
		if (!piece) continue;
		const eq = piece.indexOf('=');
		if (eq <= 0) continue;
		const name = piece.slice(0, eq).trim();
		const value = piece.slice(eq + 1).trim();
		if (!value || /[\r\n;]/.test(value)) continue;
		if (!LOGGED_IN_NAME.test(name) && !SECURE_NAME.test(name)) continue;
		pairs.push(`${name}=${value}`);
	}

	const loggedIn = pairs.filter((pair) => pair.startsWith('wordpress_logged_in_'));
	return loggedIn.length === 1 ? pairs.join('; ') : undefined;
}

function decodedCookieValue(raw: string): string {
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

export function sessionCookieMaxAge(cookieHeader: string): number {
	const pair = cookieHeader.split('; ').find((item) => item.startsWith('wordpress_logged_in_'));
	const raw = pair?.slice(pair.indexOf('=') + 1) ?? '';
	const expiry = Number(decodedCookieValue(raw).split('|', 2)[1]);
	const remaining = Math.floor(expiry - Date.now() / 1000);
	const hour = 60 * 60;
	return !Number.isFinite(remaining) || remaining < 60 ? hour : Math.min(remaining, hour * 24 * 14);
}

function catalogUrl(location: string, base: string): URL | undefined {
	try {
		const url = new URL(location, base);
		return url.hostname === 'www.mpfiltri.com' || url.hostname === 'mpfiltri.com' ? url : undefined;
	} catch {
		return undefined;
	}
}

function isLoginPage(url: URL, html: string): boolean {
	return (
		LOGIN_PATH.test(url.pathname) ||
		url.searchParams.has('mpfiltri_target') ||
		html.includes('woocommerce-form-login') ||
		html.includes('id="customer_login"')
	);
}

function mergeSetCookies(cookieHeader: string, setCookies: string[]): string {
	const jar = new Map<string, string>();
	for (const part of cookieHeader.split('; ')) {
		const eq = part.indexOf('=');
		if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
	}
	for (const cookie of setCookies) {
		const pair = cookie.split(';', 1)[0] ?? '';
		const eq = pair.indexOf('=');
		if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
	}
	const parts: string[] = [];
	for (const [name, value] of jar) parts.push(`${name}=${value}`);
	return parts.join('; ');
}

async function isInterchangeOpen(cookieHeader: string): Promise<boolean> {
	let url = INTERCHANGE_URL;
	let cookie = cookieHeader;
	for (let hop = 0; hop < 5; hop++) {
		const response = await fetch(url, {
			redirect: 'manual',
			headers: {
				...headers,
				Accept: 'text/html',
				Cookie: cookie
			},
			signal: AbortSignal.timeout(20_000)
		});
		const setCookies = response.headers.getSetCookie?.() ?? [];
		if (setCookies.length > 0) cookie = mergeSetCookies(cookie, setCookies);
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			await response.body?.cancel();
			const next = location ? catalogUrl(location, url) : undefined;
			if (!next || isLoginPage(next, '')) return false;
			url = next.toString();
			continue;
		}
		const html = await response.text();
		return response.ok && !isLoginPage(new URL(url), html);
	}
	return false;
}

export async function getSession(
	cookieHeader: string
): Promise<string | ActionFailure<{ authError: boolean }>> {
	const cookie = sessionCookieHeader(cookieHeader);
	if (!cookie) return fail(400, { authError: true });
	try {
		const accepted = await isInterchangeOpen(cookie);
		return accepted ? cookie : fail(400, { authError: true });
	} catch (error_) {
		console.error('MP Filtri session check failed', error_);
		return fail(400, { authError: true });
	}
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1, opts) => {
	const nItems = Math.min(maxItems, Infinity);
	const cookie = opts?.sessionToken ? sessionCookieHeader(opts.sessionToken) : undefined;
	if (!cookie) error(400, 'MP Filtri session cookie not found');

	const axiosReqConfig = {
		method: 'POST',
		url: INTERCHANGE_URL,
		headers: {
			...headers,
			Cookie: cookie,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept-Language': 'en-US,en;q=0.5',
			Referer: INTERCHANGE_URL,
			Origin: ORIGIN
		},
		data: { url: '', OEMSEARCH: `${code}*` }
	};
	try {
		return getHtmlToProducts(
			'mpfiltriusa',
			axiosReqConfig,
			{
				tableRows: (document) => document.querySelectorAll('#myTable > tbody > tr'),
				rowsIterator: (tableRows) => {
					const products: Product[] = [];

					for (let i = 0; i < Math.min(tableRows.length, nItems); i++) {
						const row = tableRows[i];
						products.push({
							manufacturer: row.querySelector(':nth-child(2)')?.textContent ?? '',
							manufacturer_code: row.querySelector(':nth-child(1)')?.textContent ?? '',
							source_reference_code: row.querySelector(':nth-child(3)')?.textContent ?? ''
						});
					}
					return products;
				}
			},
			config,
			page
		);
	} catch (error_) {
		if (error_ && typeof error_ === 'object' && 'status' in error_) throw error_;
		failSourceRequest(error_, 'MPfiltriUSA error');
	}
};
export const getNextProducts: GetNextProducts = () => {
	return;
};
