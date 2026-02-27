import type { GetProducts, GetNextProducts } from '../types';
import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { getHtmlToProducts } from '$lib/product_sources/getHtmlToProductsData.server';
import { headers } from '$lib/product_sources/constants';

export async function getSession(
	username: string,
	password: string
): Promise<string | ActionFailure<{ authError: boolean }> | null> {
	const options = {
		method: 'POST',
		headers: {
			...headers,
			Host: 'fbn.it',
			Accept: 'text/html, */*; q=0.01',
			'Accept-Language': 'en-US,en;q=0.5',
			'X-PJAX': 'true',
			'X-PJAX-Container': '#cr-container',
			'X-Requested-With': 'XMLHttpRequest',
			'Content-Type':
				'multipart/form-data; boundary=---------------------------407975758941551243592795615748',
			'Content-Length': '569',
			Origin: 'http://fbn.it',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			Referer: 'http://fbn.it/ita/cross-reference',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		},
		body: `-----------------------------407975758941551243592795615748\r\nContent-Disposition: form-data; name="email"\r\n\r\n${username}\r\n-----------------------------407975758941551243592795615748\r\nContent-Disposition: form-data; name="password"\r\n\r\n${password}\r\n-----------------------------407975758941551243592795615748\r\nContent-Disposition: form-data; name="lang"\r\n\r\nita\r\n-----------------------------407975758941551243592795615748\r\nContent-Disposition: form-data; name="wosid"\r\n\r\nwzATOdcOVLBWyBjm1C9eF0\r\n-----------------------------407975758941551243592795615748--\r\n`
	};
	try {
		const response = await fetch(
			'http://fbn.it/Apps/WebObjects/FBN.woa/1/wa/CRAction/login',
			options
		);

		if (!response.ok) {
			return fail(400, { authError: true });
		}
		const responseCookie = response.headers.getSetCookie();

		const wosid: string | undefined = responseCookie
			?.find((cookie) => cookie.includes('wosid'))
			?.match(new RegExp(`^wosid=(.+?);`))?.[1];

		return wosid ?? null;
	} catch (err) {
		error(500, `FBN error getting session ${err}`);
	}
}

export const getProducts: GetProducts = async (code, maxItems, config, page = 1, sessionToken?) => {
	// const nItems = Math.min(maxItems, Infinity);

	if (!sessionToken) error(400, 'FBN session token not found');
	const axiosReqConfig = {
		method: 'GET',
		url: 'http://www.fbn.it/Apps/WebObjects/FBN.woa/1/wa/CRAction/search#cr-container',
		params: {
			batchIndex: page,
			originale: code,
			marca: '',
			fbn: '',
			wosid: sessionToken,
			_pjax: ''
		},
		headers: {
			...headers,
			Host: 'www.fbn.it',
			Accept: 'text/html, */*; q=0.01',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate',
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'X-PJAX': 'true',
			'X-PJAX-Container': '#cr-container',
			'X-Requested-With': 'XMLHttpRequest',
			'Sec-GPC': '1',
			Connection: 'keep-alive',
			Priority: 'u=0',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache'
		}
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
								tableRows[i]
									.querySelector('td:nth-child(1)')
									?.textContent?.trim() ?? '',
							manufacturer_code:
								tableRows[i]
									.querySelector('td:nth-child(2)')
									?.textContent?.trim() ?? '',
							source_reference_code:
								tableRows[i]
									.querySelector('td:nth-child(3)')
									?.textContent?.trim() ?? ''
						});
					}
					return products;
				},
				nPages: (document) =>
					Number(
						document
							.querySelector("[name='batchIndex'] option:last-child")
							?.getAttribute('value')
					),
				totalItems: (document, nPages, page, nProducts) =>
					document && nProducts && page && nPages
						? page < nPages
							? String((nPages - 1) * 9) + '+'
							: nPages * nProducts
						: null
			},
			config,
			page,
			9
		);
	} catch (err) {
		error(500, `FBN error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = async (
	code,
	maxItems,
	config,
	page = 1,
	sessionToken?
) => await getProducts(code, maxItems, config, page + 1, sessionToken);
