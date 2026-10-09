import type { PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { sourcesDescriptors, sourcesGetters } from '#lib/product_sources/index.js';
import type { Actions } from './$types';

// name should be sourceID but this is also the cookie type
interface SrcSessionToken {
	name: string;
	value: string;
}

export const load: PageServerLoad = ({ url, locals }) => {
	const productCode: string | null = url.searchParams.get('q');
	const srcSessionTokens: SrcSessionToken[] = locals.srcSessions;

	const newSrcsDescriptors: SourceDescriptorsLocal[] =
		srcSessionTokens.length > 0
			? sourcesDescriptors.map((srcDescs) => ({
					...srcDescs,
					isLoggedIn:
						srcDescs.isLoggedIn !== null
							? srcSessionTokens.some((token) => token.name === srcDescs.sourceID)
								? true
								: false
							: null
				}))
			: sourcesDescriptors;

	if (productCode && !/^[\w.\-/]{3,32}$/.test(productCode)) {
		error(400, 'Bad Product Code Request');
	}
	return { newSrcsDescriptors };
};

export const actions = {
	createSrcSession: async ({ cookies, request, url }) => {
		const data = await request.formData();
		if (!data) error(500, 'create session form data error');
		const sourceID = String(data.get('sourceID'));
		const username = String(data.get('username'));
		const password = String(data.get('password'));

		const getSession = sourcesGetters[sourceID]?.getSession;
		if (!getSession || !username || !password) {
			return fail(400, { invalid: true });
		}
		const token = await getSession(username, password);
		if (!token) error(500, 'token create error');

		if (typeof token === 'string') {
			cookies.set(`${sourceID}SessionToken`, token, {
				path: '/',
				// server side only cookie so you can't use `document.cookie`
				httpOnly: true,
				// only requests from same site can send cookies
				sameSite: 'strict',
				// local Vite is http; production is https
				secure: url.protocol === 'https:',
				maxAge: 60 * 60
			});
		} else {
			if (token?.data.authError) return token;
			return fail(418);
		}

		return { sessionCreatedSuccess: true };
	},

	terminateSrcSession: async ({ cookies, request, url }) => {
		const data = await request.formData();
		if (!data) error(500, 'session termination form data error');
		const sourceID = String(data.get('sourceID'));
		if (!sourcesGetters[sourceID]?.getSession) return fail(400, { invalid: true });
		cookies.set(`${sourceID}SessionToken`, '', {
			path: '/',
			// server side only cookie so you can't use `document.cookie`
			httpOnly: true,
			// only requests from same site can send cookies
			sameSite: 'strict',
			secure: url.protocol === 'https:',
			expires: new Date(0)
		});
		return { sessionTerminatedSuccess: true };
	}
} satisfies Actions;
