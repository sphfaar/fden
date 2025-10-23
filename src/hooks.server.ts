import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const srcSessions = event.cookies
		.getAll()
		.filter((cookie) => cookie.name.endsWith('SessionToken'))
		.map((cookie) => {
			cookie.name = cookie.name.replace('SessionToken', '');
			return cookie;
		});

	event.locals.srcSessions = srcSessions;

	return await resolve(event);
};
