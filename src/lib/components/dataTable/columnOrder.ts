export const COLUMN_ORDER_KEY = 'fden:data-table-column-order';

export const DEFAULT_COLUMN_ORDER = [
	'source',
	'manufacturerCode',
	'crossCode',
	'manufacturerName',
	'thumbnails',
	'detailsUrl',
	'cachedAt'
] as const;

export type DataTableColumnId = (typeof DEFAULT_COLUMN_ORDER)[number];

const ALLOWED_COLUMN_IDS = new Set<string>(DEFAULT_COLUMN_ORDER);

export function normalizeColumnOrder(stored: unknown): string[] {
	const seen = new Set<string>();
	const next: string[] = [];

	if (Array.isArray(stored)) {
		for (const id of stored) {
			if (typeof id !== 'string' || !ALLOWED_COLUMN_IDS.has(id) || seen.has(id)) continue;
			next.push(id);
			seen.add(id);
		}
	}

	for (const id of DEFAULT_COLUMN_ORDER) {
		if (!seen.has(id)) next.push(id);
	}

	return next;
}

export function loadColumnOrder(): string[] {
	try {
		const raw = localStorage.getItem(COLUMN_ORDER_KEY);
		if (raw == null) return [...DEFAULT_COLUMN_ORDER];
		return normalizeColumnOrder(JSON.parse(raw));
	} catch {
		return [...DEFAULT_COLUMN_ORDER];
	}
}

export function saveColumnOrder(order: string[]) {
	try {
		localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(normalizeColumnOrder(order)));
	} catch {
		// private mode or quota
	}
}

export function swapColumnOrder(order: string[], fromId: string, toId: string): string[] {
	const next = normalizeColumnOrder(order);
	if (fromId === toId) return next;
	const fromIdx = next.indexOf(fromId);
	const toIdx = next.indexOf(toId);
	if (fromIdx < 0 || toIdx < 0) return next;
	[next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
	return next;
}
