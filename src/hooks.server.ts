import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import {
	safeNextPath,
	TURNSTILE_COOKIE,
	isTurnstileDevBypass,
	isTurnstilePassValid
} from '#lib/turnstile.server.js';

function isUngatedPath(pathname: string): boolean {
	return (
		pathname === '/challenge' ||
		pathname === '/challenge/' ||
		pathname.startsWith('/_app/') ||
		pathname === '/robots.txt' ||
		pathname === '/favicon.ico'
	);
}

function isDocumentRequest(request: Request): boolean {
	if (request.method !== 'GET' && request.method !== 'HEAD') return false;
	const accept = request.headers.get('accept') ?? '';
	return accept.includes('text/html');
}

export const handle: Handle = async ({ event, resolve }) => {
	const srcSessions = event.cookies
		.getAll()
		.filter((cookie) => cookie.name.endsWith('SessionToken'))
		.map((cookie) => {
			cookie.name = cookie.name.replace('SessionToken', '');
			return cookie;
		});

	event.locals.srcSessions = srcSessions;

	const allowed =
		building ||
		isUngatedPath(event.url.pathname) ||
		isTurnstileDevBypass() ||
		(await isTurnstilePassValid(event.cookies.get(TURNSTILE_COOKIE)));

	const response = allowed
		? await resolve(event)
		: event.isDataRequest || !isDocumentRequest(event.request)
			? denied(event.url.pathname)
			: redirectToChallenge(event.url);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};

function redirectToChallenge(url: URL): Response {
	const next = safeNextPath(url.pathname + url.search);
	return new Response(undefined, {
		status: 303,
		headers: {
			location: `/challenge?next=${encodeURIComponent(next)}`,
			'cache-control': 'private, no-store'
		}
	});
}

function denied(pathname: string): Response {
	const message = 'Complete the human check before using this app.';
	if (pathname.startsWith('/api/')) {
		return Response.json(
			{ message },
			{ status: 403, headers: { 'cache-control': 'private, no-store' } }
		);
	}
	return new Response(message, {
		status: 403,
		headers: {
			'content-type': 'text/plain;charset=UTF-8',
			'cache-control': 'private, no-store'
		}
	});
}
