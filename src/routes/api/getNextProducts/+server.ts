import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { sourcesGetters } from '$lib/product_sources';

export const POST: RequestHandler = async ({ request, locals }) => {
	interface RequestData {
		sourceID: string;
		meta: MetaData;
		code: string;
		maxItems: number;
	}
	const { sourceID, meta, code, maxItems }: RequestData = await request.json();

	if (!meta.totalItems && meta.pages && meta.page >= meta.pages)
		throw error(500, 'you have no more items to load');

	if (
		(typeof meta.totalItems !== 'string' &&
			meta.totalItems &&
			meta.currentItemsDisplayed > meta.totalItems) ||
		(meta.pages && meta.page >= meta.pages)
	)
		return json('reached max items to display ');

	const sourceOfData = sourcesGetters[sourceID];

	const maybeSessionToken: string | undefined = locals?.srcSessions?.find(
		(session) => session.name === sourceID
	)?.value;

	const productsData: ProductsData | undefined | null = await sourceOfData.getNextProducts(
		code,
		maxItems,
		{ showPerfReqProxyToSource: true },
		meta.page,
		maybeSessionToken
	);

	if (!productsData) error(500, 'error fetching products getting products on getNextProducts API');
	return json(productsData);
};

export const fallback: RequestHandler = async ({ request }) => {
	return json(`I caught your bad ${request.method} request!`);
};
