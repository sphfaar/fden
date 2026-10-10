import { error } from '@sveltejs/kit';
import { sourcesGetters } from '#lib/product-sources/index.js';

export const PRODUCT_CODE_PATTERN = /^[\w.\-/]{3,32}$/;
export const MAX_PRODUCT_ITEMS = 1000;
export const MAX_PRODUCT_PAGE = 1000;
export const DAILY_PRODUCT_API_LIMIT = 25_000;

const QUOTA_TTL_SECONDS = 60 * 60 * 48;

export interface DailyQuotaStore {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options: { expirationTtl: number }): Promise<unknown>;
}

export function requireProductCode(value: unknown): string {
	if (typeof value !== 'string' || !PRODUCT_CODE_PATTERN.test(value)) {
		error(400, 'Bad Product Code Request');
	}
	return value;
}

export function requireMaxItems(value: unknown): number {
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value < 1 ||
		value > MAX_PRODUCT_ITEMS
	) {
		error(400, 'Bad maxItems');
	}
	return value;
}

export function requirePage(value: unknown): number {
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value < 1 ||
		value > MAX_PRODUCT_PAGE
	) {
		error(400, 'Bad page');
	}
	return value;
}

export function requireSource(sourceID: unknown) {
	if (typeof sourceID !== 'string' || !Object.hasOwn(sourcesGetters, sourceID)) {
		error(400, 'Unknown product source');
	}
	return sourcesGetters[sourceID];
}

export async function readJsonBody(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		error(400, 'Bad Product Request');
	}
}

export function requestFields(body: unknown): Record<string, unknown> {
	if (!body || typeof body !== 'object') error(400, 'Bad Product Request');
	return body as Record<string, unknown>;
}

export async function takeDailyProductApiSlot(
	store: DailyQuotaStore,
	now = new Date()
): Promise<boolean> {
	const key = `product-api:${now.toISOString().slice(0, 10)}`;
	const raw = await store.get(key);
	const parsed = raw === null ? 0 : Number(raw);
	const used = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
	if (used >= DAILY_PRODUCT_API_LIMIT) return false;
	await store.put(key, String(used + 1), { expirationTtl: QUOTA_TTL_SECONDS });
	return true;
}
