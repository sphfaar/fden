import { error } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from '../types';

export const getProducts: GetProducts = async (code: string) => {
	const codeEncoded = encodeURIComponent(code);
	try {
		const res = await fetch(`https://vercpupp-ff.vercel.app/api/ikron?code=${codeEncoded}`, {
			headers: {
				DNT: '1',
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
			}
		});

		const data: ProductsData = await res.json();
		return data;
	} catch (err) {
		error(500, `Irkon error: ${err}`);
	}
};

export const getNextProducts: GetNextProducts = () => null;
