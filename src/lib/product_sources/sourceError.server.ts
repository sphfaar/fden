import { error, isHttpError } from '@sveltejs/kit';

export function failSourceRequest(err: unknown, label: string): never {
	if (isHttpError(err)) throw err;
	console.error(label, err);
	error(500, 'Source request failed');
}
