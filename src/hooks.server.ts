import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	const srcSessions = event.cookies
		.getAll()
		.filter((cookie) => cookie.name.endsWith('SessionToken'))
		.map((cookie) => {
			cookie.name = cookie.name.replace('SessionToken', '');
			return cookie;
		});

	event.locals.srcSessions = srcSessions;

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	return response;
};
