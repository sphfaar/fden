import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { enforceDailyProductApiLimit } from '#lib/productApiLimit.server.js';
import {
	readJsonBody,
	requestFields,
	requireMaxItems,
	requirePage,
	requireProductCode,
	requireSource
} from '#lib/productRequest.server.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	await enforceDailyProductApiLimit();
	const body = requestFields(await readJsonBody(request));
	const code = requireProductCode(body.code);
	const maxItems = requireMaxItems(body.maxItems);
	const sourceOfData = requireSource(body.sourceID);
	const meta = requestFields(body.meta);
	const page = requirePage(meta.page);

	if (!meta.totalItems && meta.pages && page >= Number(meta.pages))
		throw error(500, 'you have no more items to load');

	if (
		(typeof meta.totalItems !== 'string' &&
			meta.totalItems &&
			Number(meta.currentItemsDisplayed) > Number(meta.totalItems)) ||
		(meta.pages && page >= Number(meta.pages))
	)
		return Response.json('reached max items to display ');

	const maybeSessionToken: string | undefined = locals?.srcSessions?.find(
		(session) => session.name === body.sourceID
	)?.value;

	const productsData: ProductsData | undefined | null = await sourceOfData.getNextProducts(
		code,
		maxItems,
		{ showPerfReqProxyToSource: true },
		page,
		{
			sessionToken: maybeSessionToken
		}
	);

	if (!productsData) error(500, 'error fetching products getting products on getNextProducts API');
	return Response.json(productsData);
};

export const fallback: RequestHandler = async ({ request }) => {
	return Response.json(`I caught your bad ${request.method} request!`);
};
