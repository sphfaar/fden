import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { takeDailyProductApiSlot } from '#lib/product-request.server.js';

export async function enforceDailyProductApiLimit(): Promise<void> {
	const store = env.PRODUCT_API_QUOTA;
	if (!store) return;

	try {
		const allowed = await takeDailyProductApiSlot(store);
		if (!allowed) error(429, 'Daily product API limit reached');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('product API quota check failed', err);
	}
}
