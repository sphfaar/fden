import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { enforceDailyProductApiLimit } from '#lib/productApiLimit.server.js';
import {
	readJsonBody,
	requestFields,
	requireMaxItems,
	requireProductCode,
	requireSource
} from '#lib/productRequest.server.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	await enforceDailyProductApiLimit();
	const body = requestFields(await readJsonBody(request));
	const code = requireProductCode(body.code);
	const maxItems = requireMaxItems(body.maxItems);
	const sourceOfData = requireSource(body.sourceID);

	const maybeSessionToken: string | undefined = locals?.srcSessions?.find(
		(session) => session.name === body.sourceID
	)?.value;

	const productsData: ProductsData | undefined | null = await sourceOfData.getProducts(
		code,
		maxItems,
		{ showPerfReqProxyToSource: true },
		1,
		{ sessionToken: maybeSessionToken }
	);
	if (!productsData) error(500, 'error fetching products getting products on getNewProducts API');

	return Response.json(productsData);
};

export const fallback: RequestHandler = async ({ request }) => {
	return Response.json(`I caught your bad ${request.method} request! 🧐`);
};
