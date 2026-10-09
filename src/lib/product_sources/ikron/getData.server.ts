import { failSourceRequest } from '#lib/product_sources/sourceError.server.js';
import { headers } from '#lib/product_sources/constants.js';
import type { GetNextProducts, GetProducts } from '../types';

export const getProducts: GetProducts = async (code: string) => {
	const codeEncoded = encodeURIComponent(code);
	try {
		const res = await fetch(`https://vercpupp-ff.vercel.app/api/ikron?code=${codeEncoded}`, {
			headers: {
				...headers
			}
		});

		const data: ProductsData = await res.json();
		return data;
	} catch (err) {
		failSourceRequest(err, 'Ikron error');
	}
};

export const getNextProducts: GetNextProducts = () => undefined;
