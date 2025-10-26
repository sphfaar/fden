import { error } from '@sveltejs/kit';
import { headers } from '$lib/product_sources/constants';
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
		error(500, `Irkon error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = () => null;
