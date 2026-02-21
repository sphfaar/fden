import type { GetNextProducts, GetProducts } from '../types';

export const getProducts: GetProducts = async (code, maxItems, config) => {
	try {
		const response = await fetch('https://fleetguard-express.vercel.app/api/fleetguard', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, maxItems }),
			cache: 'no-store'
		});

		if (!response.ok) {
			throw new Error(`Proxy failed: ${response.status}`);
		}

		return (await response.json()) as ProductsData;
	} catch (err) {
		console.error('Fleetguard proxy call failed:', err);
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

export const getNextProducts: GetNextProducts = () => null;
