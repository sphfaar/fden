import type { GetProducts, GetNextProducts } from '../types';

export const getProducts: GetProducts = async (code, _maxItems, _config, page = 1) => {
	try {
		const response = await fetch('https://fden-express.vercel.app/api/argohytos', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, page }),
			cache: 'no-store'
		});

		if (!response.ok) {
			throw new Error(`Proxy failed: ${response.status}`);
		}

		return (await response.json()) as ProductsData;
	} catch (err) {
		console.error('Argo-hytos proxy call failed:', err);
		return {
			meta: {
				status: 500,
				currentItemsDisplayed: 0,
				totalItems: 0,
				maxItemsPagination: null,
				page: 0
			},
			products: []
		};
	}
};

export const getNextProducts: GetNextProducts = async (code, maxItems, config, page = 1) =>
	await getProducts(code, maxItems, config, page + 1);
