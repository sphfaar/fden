export const SEARCH_HISTORY_KEY = 'fden:search-history';

const MAX_STORED = 100;
const MAX_SHOWN = 10;

export type SearchEntry = {
	q: string;
	count: number;
	lastUsedAt: number;
};

export function loadSearchEntries(): SearchEntry[] {
	try {
		const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map(normalizeSearchEntry)
			.filter((entry): entry is SearchEntry => entry !== undefined);
	} catch {
		return [];
	}
}

export function recordSearch(rawQuery: string): SearchEntry[] {
	const q = rawQuery.trim();
	const entries = loadSearchEntries();
	if (!q) return entries;

	const now = Date.now();
	const existing = entries.find((entry) => entry.q === q);
	if (existing) {
		existing.count += 1;
		existing.lastUsedAt = now;
	} else {
		entries.push({ q, count: 1, lastUsedAt: now });
	}

	entries.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
	const capped = entries.slice(0, MAX_STORED);
	saveSearchEntries(capped);
	return capped;
}

export function listRecentQueries(entries: SearchEntry[]): SearchEntry[] {
	return [...entries].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_SHOWN);
}

export function listFrequentQueries(entries: SearchEntry[]): SearchEntry[] {
	return [...entries]
		.sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
		.slice(0, MAX_SHOWN);
}

function normalizeSearchEntry(value: unknown): SearchEntry | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const entry = value as Partial<SearchEntry>;
	if (
		typeof entry.q !== 'string' ||
		entry.q.length === 0 ||
		typeof entry.count !== 'number' ||
		!Number.isFinite(entry.count) ||
		typeof entry.lastUsedAt !== 'number' ||
		!Number.isFinite(entry.lastUsedAt)
	) {
		return undefined;
	}

	return {
		q: entry.q,
		count: entry.count,
		lastUsedAt: entry.lastUsedAt
	};
}

function saveSearchEntries(entries: SearchEntry[]) {
	try {
		localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries));
	} catch {
		// private mode or quota
	}
}
