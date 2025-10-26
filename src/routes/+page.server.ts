import type { PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { sourcesDescriptors, sourcesGetters } from '$lib/product_sources';
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

	if (productCode) {
		const queryRegex = /^[\w.\-/]{3,32}$/;
		if (!queryRegex.test(productCode)) {
			error(400, 'Bad Product Code Request');
		}

		const prodsFromSrcPromises: ProductsFromSourcePromises = new Map();

		newSrcsDescriptors
			.filter((srcDescriptors) => {
				return (
					url.searchParams.get(srcDescriptors.sourceID) === '1' &&
					srcDescriptors.isLoggedIn !== false
				);
			})
			.forEach((srcDescriptors) => {
				const maybeSessionToken: string | null =
					srcSessionTokens.find((token) => token.name === srcDescriptors.sourceID)?.name ?? null;
				prodsFromSrcPromises.set(
					srcDescriptors,
					sourcesGetters?.[srcDescriptors.sourceID].getProducts(
						productCode,
						1000,
						{ showPerfReqProxyToSource: true },
						1,
						maybeSessionToken ?? undefined
					)
				);
			});
		return { newSrcsDescriptors, prodsFromSrcPromises };
	}
	return { newSrcsDescriptors };
};

export const actions = {
	createSrcSession: async ({ cookies, request }) => {
		const data = await request.formData();
		if (!data) error(500, 'create session form data error');
		const sourceID = String(data.get('sourceID'));
		const username = String(data.get('username'));
		const password = String(data.get('password'));

		if (
			typeof sourceID !== 'string' ||
			typeof username !== 'string' ||
			typeof password !== 'string' ||
			!username ||
			!password
		) {
			return fail(400, { invalid: true });
		}
		const token = sourcesGetters?.[sourceID].getSession
			? await sourcesGetters?.[sourceID].getSession(username, password)
			: null;
		if (!token) error(500, 'token create error');

		if (typeof token === 'string') {
			cookies.set(`${sourceID}SessionToken`, token, {
				path: '/',
				// server side only cookie so you can't use `document.cookie`
				httpOnly: true,
				// only requests from same site can send cookies
				sameSite: 'strict',
				secure: false,
				maxAge: 60 * 60
			});
		} else {
			if (token?.data.authError) return token;
			return fail(418);
		}

		return { sessionCreatedSuccess: true };
	},

	terminateSrcSession: async ({ cookies, request }) => {
		const data = await request.formData();
		if (!data) error(500, 'session termination form data error');
		const sourceID = String(data.get('sourceID'));
		cookies.set(`${sourceID}SessionToken`, '', {
			path: '/',
			// server side only cookie so you can't use `document.cookie`
			httpOnly: true,
			// only requests from same site can send cookies
			sameSite: 'strict',
			// only sent over HTTPS in production
			// secure: false,
			expires: new Date(0)
		});
		return { sessionTerminatedSuccess: true };
	}
} satisfies Actions;
