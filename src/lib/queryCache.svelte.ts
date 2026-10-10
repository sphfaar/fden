import { browser } from '$app/env';

const DB_NAME = 'fden-query-cache';
const DB_VERSION = 1;
const STORE = 'queries';
const CHANNEL = 'fden-query-cache';

export interface CachedPage {
	page: number;
	fetchedAt: string;
	products: Product[];
	meta: Metadata;
}

/** One cached search for a single source. `pagesFetched` is how far paging got. */
export interface CachedQueryRecord {
	sourceID: string;
	code: string;
	pagesFetched: number;
	pages: CachedPage[];
	oldest: string;
	newest: string;
	productCount: number;
	byteSize: number;
}

export interface SourceCacheStats {
	queries: number;
	products: number;
	oldest?: string;
	newest?: string;
	/** Newest `fetchedAt` for each cached code on this source. */
	newestByCode: Record<string, string>;
}

export function formatCacheSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function asProductsData(value: unknown): ProductsData | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const data = value as Partial<ProductsData>;
	if (!data.meta || typeof data.meta !== 'object' || !Array.isArray(data.products))
		return undefined;
	if (typeof data.meta.status !== 'number' || typeof data.meta.page !== 'number') return undefined;
	return data as ProductsData;
}

/** Successful payloads only. HTTP errors and the empty 500 fallbacks stay uncached. */
export function isCacheableProducts(data: ProductsData): boolean {
	return data.meta.status > 0 && data.meta.status < 400;
}

export function stampProducts(products: Product[], fetchedAt: string): Product[] {
	return products.map((product) => ({ ...product, cachedAt: fetchedAt }));
}

export function cachedPageFromProducts(
	page: number,
	data: ProductsData,
	fetchedAt: string
): CachedPage {
	return {
		page,
		fetchedAt,
		meta: data.meta,
		products: stampProducts(data.products, fetchedAt)
	};
}

export function productsDataFromCachedPage(page: CachedPage): ProductsData {
	return {
		meta: page.meta,
		products: page.products
	};
}

export function mergeNextPage(previous: ProductsData, next: ProductsData): ProductsData {
	return {
		meta: {
			...next.meta,
			currentItemsDisplayed: previous.meta.currentItemsDisplayed + next.meta.currentItemsDisplayed
		},
		products: previous.products.concat(next.products)
	};
}

export function accumulateCachedPages(pages: CachedPage[]): ProductsData {
	const ordered = [...pages].sort((a, b) => a.page - b.page);
	let data = productsDataFromCachedPage(ordered[0]);
	for (const page of ordered.slice(1)) {
		data = mergeNextPage(data, productsDataFromCachedPage(page));
	}
	return data;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function summarizePages(
	pages: CachedPage[]
): Pick<CachedQueryRecord, 'pagesFetched' | 'oldest' | 'newest' | 'productCount'> {
	let oldest = pages[0]?.fetchedAt ?? '';
	let newest = oldest;
	let productCount = 0;
	for (const page of pages) {
		productCount += page.products.length;
		if (page.fetchedAt < oldest) oldest = page.fetchedAt;
		if (page.fetchedAt > newest) newest = page.fetchedAt;
	}
	return { pagesFetched: pages.length, oldest, newest, productCount };
}

function measureRecord(record: Omit<CachedQueryRecord, 'byteSize'>): number {
	return new TextEncoder().encode(JSON.stringify({ ...record, byteSize: 0 })).length;
}

function toRecord(sourceID: string, code: string, pages: CachedPage[]): CachedQueryRecord {
	const storedPages = clone(pages);
	const summary = summarizePages(storedPages);
	const base = { sourceID, code, pages: storedPages, ...summary };
	return { ...base, byteSize: measureRecord(base) };
}

function isRecord(value: unknown): value is CachedQueryRecord {
	if (!value || typeof value !== 'object') return false;
	const record = value as Partial<CachedQueryRecord>;
	return (
		typeof record.sourceID === 'string' &&
		typeof record.code === 'string' &&
		typeof record.pagesFetched === 'number' &&
		Array.isArray(record.pages)
	);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'));
	});
}

function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'));
		tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'));
	});
}

function isQuotaError(error: unknown): boolean {
	return (
		(error instanceof DOMException &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) ||
		(typeof error === 'object' &&
			error !== null &&
			'name' in error &&
			(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'))
	);
}

class QueryCache {
	queryCount = $state(0);
	byteSize = $state(0);
	bySource = $state.raw<Record<string, SourceCacheStats>>({});
	ready = $state(false);

	#db: IDBDatabase | null = null;
	#opening: Promise<IDBDatabase | null> | null = null;
	#tail: Promise<void> = Promise.resolve();
	#channel: BroadcastChannel | null = null;

	open = (): Promise<void> => this.#enqueue(() => this.#refreshStats());

	get = (sourceID: string, code: string): Promise<CachedQueryRecord | null> =>
		this.#enqueue(() => this.#get(sourceID, code));

	putPage = (sourceID: string, code: string, page: CachedPage): Promise<void> =>
		this.#enqueue(() => this.#putPage(sourceID, code, page));

	replace = (sourceID: string, code: string, pages: CachedPage[]): Promise<void> =>
		this.#enqueue(() => this.#replace(sourceID, code, pages));

	purge = (): Promise<void> => this.#enqueue(() => this.#purge());

	#enqueue<T>(task: () => Promise<T>): Promise<T> {
		const run = this.#tail.then(task, task);
		this.#tail = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	}

	async #database(): Promise<IDBDatabase | null> {
		if (!browser || typeof indexedDB === 'undefined') return null;
		if (this.#db) return this.#db;
		this.#opening ??= this.#open();
		this.#db = await this.#opening;
		if (this.#db && !this.#channel && typeof BroadcastChannel !== 'undefined') {
			try {
				this.#channel = new BroadcastChannel(CHANNEL);
				this.#channel.onmessage = () => {
					void this.#enqueue(() => this.#refreshStats());
				};
			} catch (error) {
				console.error(error);
			}
		}
		return this.#db;
	}

	#open(): Promise<IDBDatabase | null> {
		return new Promise((resolve) => {
			let request: IDBOpenDBRequest;
			try {
				request = indexedDB.open(DB_NAME, DB_VERSION);
			} catch (error) {
				console.error(error);
				resolve(null);
				return;
			}
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE)) {
					db.createObjectStore(STORE, { keyPath: ['sourceID', 'code'] });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				console.error(request.error);
				resolve(null);
			};
			request.onblocked = () => resolve(null);
		});
	}

	async #get(sourceID: string, code: string): Promise<CachedQueryRecord | null> {
		const db = await this.#database();
		if (!db) return null;
		const tx = db.transaction(STORE, 'readonly');
		const value = await requestToPromise(tx.objectStore(STORE).get([sourceID, code]));
		await transactionDone(tx);
		if (!isRecord(value)) return null;
		return value;
	}

	async #putPage(sourceID: string, code: string, page: CachedPage): Promise<void> {
		if (!Number.isInteger(page.page) || page.page < 1) return;
		const existing = await this.#get(sourceID, code);
		// Pages are stored contiguously from 1 so a later page can be found by index.
		if (!existing) {
			if (page.page !== 1) return;
			await this.#write(toRecord(sourceID, code, [page]));
			return;
		}
		const pages = [...existing.pages].sort((a, b) => a.page - b.page);
		if (page.page === pages.length + 1) {
			pages.push(page);
		} else if (page.page <= pages.length) {
			pages[page.page - 1] = page;
		} else {
			return;
		}
		await this.#write(toRecord(sourceID, code, pages));
	}

	async #replace(sourceID: string, code: string, pages: CachedPage[]): Promise<void> {
		if (pages.length === 0) return;
		const ordered = [...pages].sort((a, b) => a.page - b.page);
		await this.#write(toRecord(sourceID, code, ordered));
	}

	async #write(record: CachedQueryRecord): Promise<void> {
		const db = await this.#database();
		if (!db) return;
		try {
			await this.#put(db, record);
		} catch (error) {
			if (!isQuotaError(error)) {
				console.error(error);
				return;
			}
			await this.#deleteOldest(db);
			try {
				await this.#put(db, record);
			} catch (retryError) {
				console.error(retryError);
				return;
			}
		}
		await this.#refreshStats();
		this.#notify();
	}

	async #put(db: IDBDatabase, record: CachedQueryRecord): Promise<void> {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(record);
		await transactionDone(tx);
	}

	async #deleteOldest(db: IDBDatabase): Promise<void> {
		const tx = db.transaction(STORE, 'readwrite');
		const records = await requestToPromise(tx.objectStore(STORE).getAll());
		await transactionDone(tx);
		if (!Array.isArray(records) || records.length === 0) return;
		let oldest: CachedQueryRecord | null = null;
		for (const value of records) {
			if (!isRecord(value)) continue;
			if (!oldest || value.newest < oldest.newest) oldest = value;
		}
		if (!oldest) return;
		const deleteTx = db.transaction(STORE, 'readwrite');
		deleteTx.objectStore(STORE).delete([oldest.sourceID, oldest.code]);
		await transactionDone(deleteTx);
	}

	async #purge(): Promise<void> {
		const db = await this.#database();
		if (!db) return;
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).clear();
		await transactionDone(tx);
		this.queryCount = 0;
		this.byteSize = 0;
		this.bySource = {};
		this.ready = true;
		this.#notify();
	}

	async #refreshStats(): Promise<void> {
		const db = await this.#database();
		if (!db) {
			this.ready = false;
			return;
		}
		const tx = db.transaction(STORE, 'readonly');
		const records = await requestToPromise(tx.objectStore(STORE).getAll());
		await transactionDone(tx);
		const bySource: Record<string, SourceCacheStats> = {};
		let byteSize = 0;
		let queryCount = 0;
		if (Array.isArray(records)) {
			for (const value of records) {
				if (!isRecord(value)) continue;
				queryCount += 1;
				byteSize += typeof value.byteSize === 'number' ? value.byteSize : 0;
				const stats = bySource[value.sourceID] ?? {
					queries: 0,
					products: 0,
					newestByCode: {}
				};
				stats.queries += 1;
				stats.products += value.productCount ?? 0;
				if (value.oldest && (!stats.oldest || value.oldest < stats.oldest)) {
					stats.oldest = value.oldest;
				}
				if (value.newest && (!stats.newest || value.newest > stats.newest)) {
					stats.newest = value.newest;
				}
				if (value.code && value.newest) stats.newestByCode[value.code] = value.newest;
				bySource[value.sourceID] = stats;
			}
		}
		this.queryCount = queryCount;
		this.byteSize = byteSize;
		this.bySource = bySource;
		this.ready = true;
	}

	#notify() {
		this.#channel?.postMessage({ type: 'update' });
	}
}

export const queryCache = new QueryCache();
