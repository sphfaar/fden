import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	issueTurnstilePass,
	readTurnstileKeys,
	safeNextPath,
	TURNSTILE_COOKIE,
	TURNSTILE_PASS_SECONDS,
	isTurnstilePassValid,
	isTurnstileTokenValid
} from '#lib/turnstile.server.js';

export const load: PageServerLoad = async ({ cookies, setHeaders, url }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const next = safeNextPath(url.searchParams.get('next') ?? undefined);
	if (await isTurnstilePassValid(cookies.get(TURNSTILE_COOKIE))) redirect(303, next);
	return { next, siteKey: readTurnstileKeys()?.siteKey };
};

export const actions = {
	default: async ({ cookies, request, url }) => {
		const keys = readTurnstileKeys();
		if (!keys) {
			return fail(503, {
				message: 'Turnstile is not configured on this server yet.'
			});
		}

		const form = await request.formData();
		const token = form.get('cf-turnstile-response');
		if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
			return fail(400, { message: 'The check did not finish. Try again.' });
		}

		const nextField = form.get('next');
		const next = safeNextPath(typeof nextField === 'string' ? nextField : undefined);
		const passed = await isTurnstileTokenValid(
			keys,
			token,
			url.hostname,
			request.headers.get('cf-connecting-ip') ?? undefined
		);
		if (!passed) return fail(400, { message: 'The check failed. Try again.' });

		const pass = await issueTurnstilePass(keys.secretKey);
		if (!pass) return fail(500, { message: 'The check could not be saved. Try again.' });

		cookies.set(TURNSTILE_COOKIE, pass, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: TURNSTILE_PASS_SECONDS
		});
		redirect(303, next);
	}
} satisfies Actions;
