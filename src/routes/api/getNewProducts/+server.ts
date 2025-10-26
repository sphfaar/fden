import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { sourcesGetters } from '$lib/product_sources';

export const POST: RequestHandler = async ({ request, locals }) => {
	interface RequestData {
		sourceID: string;
		code: string;
		maxItems: number;
	}
	const { sourceID, code, maxItems }: RequestData = await request.json();
	const queryRegex = /^[\w.\-/]{3,32}$/;
	if (!queryRegex.test(code)) {
		error(400, 'Bad Product Code Request');
	}

	const sourceOfData = sourcesGetters[sourceID];

	const maybeSessionToken: string | undefined = locals?.srcSessions?.find(
		(session) => session.name === sourceID
	)?.value;

	const productsData: ProductsData | undefined | null = await sourceOfData.getProducts(
		code,
		maxItems,
		{ showPerfReqProxyToSource: true },
		1,
		maybeSessionToken
	);
	if (!productsData) error(500, 'error fetching products getting products on getNewProducts API');

	return json(productsData);
};

export const fallback: RequestHandler = async ({ request }) => {
	return json(`I caught your bad ${request.method} request! 🧐`);
};
