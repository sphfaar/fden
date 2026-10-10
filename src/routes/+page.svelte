<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	// import { browser } from '$app/env';
	import { page } from '$app/state';
	import { disableScrollHandling, afterNavigate } from '$app/navigation';
	import {
		asProductsData,
		cachedPageFromProducts,
		formatCacheSize,
		isCacheableProducts,
		mergeNextPage,
		productsDataFromCachedPage,
		queryCache,
		type CachedPage,
		type CachedQueryRecord
	} from '#lib/queryCache.svelte.js';
	import {
		listFrequentQueries,
		listRecentQueries,
		loadSearchEntries,
		recordSearch,
		SEARCH_HISTORY_KEY,
		type SearchEntry
	} from '#lib/searchHistory.js';
	import {
		DEFAULT_LEGEND_SLIDER,
		LEGEND_SLIDER_KEY,
		loadLegendSlider,
		saveLegendSlider
	} from '#lib/legendSlider.js';
	import { quintOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import ButtonsByScrapingType from '#lib/components/ButtonsByScrapingType.svelte';
	import SourceCard from '#lib/components/SourceCard.svelte';
	import DataTable from '#lib/components/dataTable/DataTable.svelte';
	import SrcSessionForm from '#lib/components/SrcSessionForm.svelte';
	import { scrapingTypeColors } from '#lib/scarpingTypes.js';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { PageProps } from './$types';
	import Search from '@lucide/svelte/icons/search';
	import ListClock from '@lucide/svelte/icons/list-clock';
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import DatabaseZap from '@lucide/svelte/icons/database-zap';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import type { Component } from 'svelte';

	const [send, receive] = crossfade({
		duration: (d) => Math.sqrt(d * 200),
		fallback(node) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 300,
				easing: quintOut,
				css: (t) => `
					transform: ${transform} scale(${t});
					opacity: ${t}
				`
			};
		}
	});

	let { data, form }: PageProps = $props();

	const maxItemsPerSrc = $state(1000);

	const codeRgx = /^[\w.\-/]{3,32}$/;
	let code = $state(page.url.searchParams.get('q') ?? '');
	let isLoadingTable = $state(false);
	let isLoadingMoreProductsOnTable = $state(false);
	let searchEntries = $state.raw<SearchEntry[]>([]);
	const recentQueries = $derived(listRecentQueries(searchEntries));
	const frequentQueries = $derived(listFrequentQueries(searchEntries));
	let searchForm: HTMLFormElement | undefined = $state();
	let legendSlider = $state(DEFAULT_LEGEND_SLIDER);
	const frequentChipWidth = $derived(1 - legendSlider);
	let legendSliderHandle: HTMLElement | null = null;
	let legendSliderDragging = false;
	let legendSliderRaf = 0;
	let legendSliderPending: number | undefined = undefined;

	const prodsFromSrcPromises: ProductsFromSourcePromises = new SvelteMap(); //products will be added here also by APIs
	const prodsFromSrcFulfilled: ProductsFromSources = new SvelteMap();

	let productsOfTable: ProductOfTable[] = $derived.by(() => {
		const pot: ProductOfTable[] = [];
		for (const [srcDescs, prodsData] of prodsFromSrcPromises.entries()) {
			const fulfilled = prodsFromSrcFulfilled.get(prodsData);
			if (!fulfilled || !isSourceCardChecked(srcDescs.sourceID)) continue;
			const products = fulfilled.productsData.products || [];
			for (const product of products) {
				pot.push({
					source: {
						name: srcDescs.name,
						image: srcDescs.logo ?? srcDescs.banner
					},
					manufacturerCode: product.manufacturer_code,
					crossCode: product.source_reference_code,
					manufacturerName: product.manufacturer,
					detailsUrl: product.detailsUrl,
					thumbnails: product.thumbnails,
					cachedAt: product.cachedAt,
					category: product.category,
					description: product.description,
					longDescription: product.longDescription,
					dimensions: product.dimensions,
					specs: product.specs,
					packaging: product.packaging
				});
			}
		}
		return pot;
	});

	let enabledSourceCards: EnabledSourceCard[] = $state([]);

	let sourceCardsMetadataPromises = $derived(
		new Map<string, Promise<Metadata> | undefined>(
			enabledSourceCards.map((enabledSC) => {
				const pfspSrcDescsKey = prodsFromSrcPromises
					.keys()
					.find((srcDescs) => srcDescs.sourceID === enabledSC.sourceDescriptors.sourceID);
				if (prodsFromSrcPromises && pfspSrcDescsKey) {
					const metaDataPromise: Promise<Metadata> | undefined = prodsFromSrcPromises
						.get(pfspSrcDescsKey)
						?.then((prodsData) => prodsData.meta);
					return [enabledSC.sourceDescriptors.sourceID, metaDataPromise];
				} else {
					return [enabledSC.sourceDescriptors.sourceID, undefined];
				}
			})
		)
	);

	// let tableWorker: Worker | null = null;

	const inFlightInitial = new SvelteSet<string>();
	const refreshingSources = new SvelteSet<string>();
	const loadedPages = new SvelteMap<string, number>();
	const requestToken = new SvelteMap<string, number>();
	let requestSerial = 0;
	let productLoadCount = 0;
	let appliedSearchKey = '';

	function isSourceCardChecked(sourceID: string) {
		return enabledSourceCards.find((enabledSC) => enabledSC.sourceDescriptors.sourceID === sourceID)
			?.isChecked;
	}

	// async function initTableWorker() {
	// 	if (browser && window.Worker) {
	// 		const Worker = await import('#lib/tableWorker?worker');
	// 		if (!Worker) error(500, 'worker creation error on page');
	// 		tableWorker = new Worker.default();
	// 	}
	// }

	function loadedKey(sourceID: string, query: string) {
		return `${sourceID}\n${query}`;
	}

	function beginRequest(sourceID: string) {
		const token = ++requestSerial;
		requestToken.set(sourceID, token);
		return token;
	}

	function stillCurrent(sourceID: string, token: number) {
		return (requestToken.get(sourceID) ?? 0) === token;
	}

	function beginTableLoad() {
		productLoadCount += 1;
		isLoadingMoreProductsOnTable = true;
	}

	function endTableLoad() {
		productLoadCount = Math.max(0, productLoadCount - 1);
		isLoadingMoreProductsOnTable = productLoadCount > 0;
	}

	function errorMessageFromBody(body: unknown, fallback: string) {
		if (
			body &&
			typeof body === 'object' &&
			'message' in body &&
			typeof body.message === 'string' &&
			body.message
		) {
			return body.message;
		}
		return fallback;
	}

	async function postProducts(
		path: '/api/getNewProducts' | '/api/getNextProducts',
		payload: Record<string, unknown>
	): Promise<ProductsData> {
		const response = await fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const body: unknown = await response.json().catch(() => undefined);
		const data = asProductsData(body);
		if (!response.ok || !data) {
			throw new Error(errorMessageFromBody(body, `error fetching products (${response.status})`));
		}
		return data;
	}

	function orderedCachedPages(record: CachedQueryRecord): CachedPage[] {
		return [...record.pages].sort((a, b) => a.page - b.page);
	}

	function sourceDescriptorsFor(sourceID: string) {
		return data.newSrcsDescriptors.find((srcDesc) => srcDesc.sourceID === sourceID);
	}

	// The map is keyed by descriptor object. A new search replaces that object, so drop the previous entry or the table shows both.
	function setSourceProducts(sourceDescs: SourceDescriptors, promise: Promise<ProductsData>) {
		for (const key of [...prodsFromSrcPromises.keys()]) {
			if (key !== sourceDescs && key.sourceID === sourceDescs.sourceID) {
				prodsFromSrcPromises.delete(key);
			}
		}
		prodsFromSrcPromises.set(sourceDescs, promise);
	}

	function queryForSource(sourceID: string) {
		const card = enabledSourceCards.find((src) => src.sourceDescriptors.sourceID === sourceID);
		const query = (card?.lastCodeQuery ?? code).trim();
		return codeRgx.test(query) ? query : code.trim();
	}

	async function loadInitialProducts(sourceID: string, query = code.trim()): Promise<void> {
		if (!codeRgx.test(query)) return;
		const sourceDescs = sourceDescriptorsFor(sourceID);
		if (!sourceDescs) return;

		const card = enabledSourceCards.find((src) => src.sourceDescriptors.sourceID === sourceID);
		if (card) {
			card.lastCodeQuery = query;
			card.isDataLoaded = true;
		}
		for (const other of enabledSourceCards) {
			if (other.sourceDescriptors.sourceID === sourceID) continue;
			if (
				other.isChecked &&
				other.lastCodeQuery !== query &&
				!other.isDataLoaded &&
				other.sourceDescriptors.isLoggedIn !== false
			) {
				void loadInitialProducts(other.sourceDescriptors.sourceID, query);
			}
		}

		const flightKey = `${sourceID}|${query}`;
		if (inFlightInitial.has(flightKey)) return;
		inFlightInitial.add(flightKey);
		const token = beginRequest(sourceID);
		beginTableLoad();
		try {
			const cached = await queryCache.get(sourceID, query);
			const firstPage = cached
				? orderedCachedPages(cached).find((page) => page.page === 1)
				: undefined;
			if (firstPage) {
				if (!stillCurrent(sourceID, token)) return;
				loadedPages.set(loadedKey(sourceID, query), 1);
				setSourceProducts(sourceDescs, Promise.resolve(productsDataFromCachedPage(firstPage)));
				return;
			}

			const fresh = await postProducts('/api/getNewProducts', {
				sourceID,
				code: query,
				maxItems: maxItemsPerSrc
			});
			if (!stillCurrent(sourceID, token)) return;
			if (isCacheableProducts(fresh)) {
				const page = cachedPageFromProducts(1, fresh, new Date().toISOString());
				await queryCache.putPage(sourceID, query, page);
				if (!stillCurrent(sourceID, token)) return;
				loadedPages.set(loadedKey(sourceID, query), 1);
				setSourceProducts(sourceDescs, Promise.resolve(productsDataFromCachedPage(page)));
				return;
			}
			loadedPages.set(loadedKey(sourceID, query), 1);
			setSourceProducts(sourceDescs, Promise.resolve(fresh));
		} catch (err) {
			console.error(err);
			if (!stillCurrent(sourceID, token)) return;
			const rejected = Promise.reject(err instanceof Error ? err : new Error(String(err)));
			void rejected.catch(() => {});
			setSourceProducts(sourceDescs, rejected);
		} finally {
			inFlightInitial.delete(flightKey);
			endTableLoad();
		}
	}

	function storedProductsFor(sourceID: string) {
		const current = sourceDescriptorsFor(sourceID);
		const direct = current ? prodsFromSrcPromises.get(current) : undefined;
		if (direct && current) return { sourceDescs: current, promise: direct };
		for (const [sourceDescs, promise] of prodsFromSrcPromises) {
			if (sourceDescs.sourceID === sourceID) return { sourceDescs, promise };
		}
		return undefined;
	}

	async function loadNextProducts(sourceID: string) {
		const query = queryForSource(sourceID);
		if (!codeRgx.test(query)) return;
		const stored = storedProductsFor(sourceID);
		if (!stored || refreshingSources.has(sourceID)) return;

		const token = requestToken.get(sourceID) ?? 0;
		beginTableLoad();
		try {
			const oldProducts = await stored.promise;
			if (!oldProducts || !stillCurrent(sourceID, token)) return;
			const srcDescs = sourceDescriptorsFor(sourceID) ?? stored.sourceDescs;

			const cached = await queryCache.get(sourceID, query);
			const loaded = loadedPages.get(loadedKey(sourceID, query)) ?? 1;
			const nextCached = cached
				? orderedCachedPages(cached).find((page) => page.page === loaded + 1)
				: undefined;
			if (nextCached && loaded < (cached?.pagesFetched ?? 0)) {
				if (!stillCurrent(sourceID, token)) return;
				loadedPages.set(loadedKey(sourceID, query), loaded + 1);
				setSourceProducts(
					srcDescs,
					Promise.resolve(mergeNextPage(oldProducts, productsDataFromCachedPage(nextCached)))
				);
				return;
			}

			const responseData = await postProducts('/api/getNextProducts', {
				sourceID,
				meta: oldProducts.meta,
				code: query,
				maxItems: maxItemsPerSrc
			});
			if (!stillCurrent(sourceID, token)) return;
			if (!isCacheableProducts(responseData)) return;
			const page = cachedPageFromProducts(loaded + 1, responseData, new Date().toISOString());
			await queryCache.putPage(sourceID, query, page);
			if (!stillCurrent(sourceID, token)) return;
			loadedPages.set(loadedKey(sourceID, query), loaded + 1);
			setSourceProducts(
				srcDescs,
				Promise.resolve(mergeNextPage(oldProducts, productsDataFromCachedPage(page)))
			);
		} catch (err) {
			console.error(err);
		} finally {
			endTableLoad();
		}
	}

	async function refreshCachedQuery(sourceID: string): Promise<void> {
		const typed = code.trim();
		const query = codeRgx.test(typed) ? typed : queryForSource(sourceID);
		if (!codeRgx.test(query)) return;
		const sourceDescs = sourceDescriptorsFor(sourceID);
		if (!sourceDescs || refreshingSources.has(sourceID)) return;

		const card = enabledSourceCards.find((src) => src.sourceDescriptors.sourceID === sourceID);
		if (card) {
			card.lastCodeQuery = query;
			card.isDataLoaded = true;
		}

		refreshingSources.add(sourceID);
		const token = beginRequest(sourceID);
		beginTableLoad();
		try {
			const existing = await queryCache.get(sourceID, query);
			const targetPages = Math.max(existing?.pagesFetched ?? 0, 1);
			const first = await postProducts('/api/getNewProducts', {
				sourceID,
				code: query,
				maxItems: maxItemsPerSrc
			});
			if (!stillCurrent(sourceID, token)) return;
			if (!isCacheableProducts(first)) {
				console.error('refresh skipped uncacheable response', sourceID, first.meta.status);
				return;
			}

			const pages: CachedPage[] = [cachedPageFromProducts(1, first, new Date().toISOString())];
			let accumulated = productsDataFromCachedPage(pages[0]);
			for (let pageNumber = 2; pageNumber <= targetPages; pageNumber += 1) {
				const next = await postProducts('/api/getNextProducts', {
					sourceID,
					meta: accumulated.meta,
					code: query,
					maxItems: maxItemsPerSrc
				});
				if (!stillCurrent(sourceID, token)) return;
				if (!isCacheableProducts(next)) {
					console.error('refresh stopped on uncacheable page', sourceID, pageNumber);
					return;
				}
				const page = cachedPageFromProducts(pageNumber, next, new Date().toISOString());
				pages.push(page);
				accumulated = mergeNextPage(accumulated, productsDataFromCachedPage(page));
			}

			await queryCache.replace(sourceID, query, pages);
			if (!stillCurrent(sourceID, token)) return;
			loadedPages.set(loadedKey(sourceID, query), pages.length);
			const cardNow = enabledSourceCards.find((src) => src.sourceDescriptors.sourceID === sourceID);
			if (cardNow) {
				cardNow.lastCodeQuery = query;
				cardNow.isDataLoaded = true;
			}
			setSourceProducts(sourceDescs, Promise.resolve(accumulated));
		} catch (err) {
			console.error(err);
		} finally {
			refreshingSources.delete(sourceID);
			endTableLoad();
		}
	}

	function checkOutdatedSourceData() {
		for (let i = 0; i < enabledSourceCards.length; i++) {
			if (enabledSourceCards[i].lastCodeQuery === code) {
				enabledSourceCards[i].isDataLoaded = true;
			} else {
				enabledSourceCards[i].isDataLoaded = false;
			}
		}
	}

	async function searchFromEntry(entry: SearchEntry) {
		code = entry.q;
		checkOutdatedSourceData();
		await tick();
		searchForm?.requestSubmit();
	}

	function recordCurrentSearch() {
		const q = code.trim();
		if (!codeRgx.test(q)) return;
		searchEntries = recordSearch(q);
	}

	function clamp01(n: number) {
		return Math.min(1, Math.max(0, n));
	}

	function flushLegendSlider() {
		legendSliderRaf = 0;
		if (legendSliderPending === undefined) return;
		legendSlider = legendSliderPending;
		legendSliderPending = undefined;
		saveLegendSlider(legendSlider);
	}

	function scheduleLegendSlider(next: number) {
		legendSliderPending = clamp01(next);
		if (legendSliderRaf) return;
		legendSliderRaf = requestAnimationFrame(flushLegendSlider);
	}

	function commitLegendSlider(next: number) {
		if (legendSliderRaf) {
			cancelAnimationFrame(legendSliderRaf);
			legendSliderRaf = 0;
		}
		legendSliderPending = undefined;
		legendSlider = clamp01(next);
		saveLegendSlider(legendSlider);
	}

	function legendSliderFromPointer(event: PointerEvent) {
		const handle = legendSliderHandle;
		const track = handle?.parentElement;
		if (!handle || !track) return undefined;
		const rect = track.getBoundingClientRect();
		const handleW = handle.offsetWidth;
		const max = rect.width - handleW;
		if (max <= 0) return 0;
		return clamp01((event.clientX - rect.left - handleW / 2) / max);
	}

	function updateLegendSlider(event: PointerEvent) {
		const next = legendSliderFromPointer(event);
		if (next === undefined) return;
		scheduleLegendSlider(next);
	}

	function onLegendSliderPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		legendSliderHandle = event.currentTarget as HTMLElement;
		legendSliderDragging = true;
		try {
			legendSliderHandle.setPointerCapture(event.pointerId);
		} catch {
			// pointer capture is optional; window listeners keep the drag
		}
		const next = legendSliderFromPointer(event);
		if (next !== undefined) commitLegendSlider(next);
	}

	function onLegendSliderPointerMove(event: PointerEvent) {
		if (!legendSliderDragging) return;
		updateLegendSlider(event);
	}

	function endLegendSliderDrag() {
		if (!legendSliderDragging) return;
		legendSliderDragging = false;
		legendSliderHandle = null;
		if (legendSliderRaf) {
			cancelAnimationFrame(legendSliderRaf);
			flushLegendSlider();
		}
	}

	function onLegendSliderKeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.05;
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				event.preventDefault();
				commitLegendSlider(legendSlider - step);
				break;
			case 'ArrowRight':
			case 'ArrowUp':
				event.preventDefault();
				commitLegendSlider(legendSlider + step);
				break;
			case 'Home':
				event.preventDefault();
				commitLegendSlider(0);
				break;
			case 'End':
				event.preventDefault();
				commitLegendSlider(1);
				break;
		}
	}

	function onSearchHistoryStorage(event: StorageEvent) {
		if (event.key === SEARCH_HISTORY_KEY) {
			searchEntries = loadSearchEntries();
			return;
		}
		if (event.key === LEGEND_SLIDER_KEY) {
			legendSlider = loadLegendSlider();
		}
	}

	async function addFulfilledProdsToSrc(
		sourceDescs: SourceDescriptors,
		prodsDataPromise: Promise<ProductsData>
	) {
		isLoadingTable = true;
		try {
			const productsData = await prodsDataPromise;
			prodsFromSrcFulfilled.set(prodsDataPromise, {
				sourceDescriptors: sourceDescs,
				productsData
			});
		} catch {
			// SourceCard renders the rejection on the source card.
		} finally {
			isLoadingTable = false;
		}
	}

	$effect(() => {
		const query = page.url.searchParams.get('q') ?? '';
		const selectedIds = data.newSrcsDescriptors
			.filter((src) => page.url.searchParams.get(src.sourceID) === '1' && src.isLoggedIn !== false)
			.map((src) => src.sourceID);
		const key = `${query}|${selectedIds.join(',')}`;
		if (!codeRgx.test(query) || selectedIds.length === 0) return;
		untrack(() => {
			if (appliedSearchKey === key) return;
			appliedSearchKey = key;
			for (const sourceID of selectedIds) void loadInitialProducts(sourceID, query);
		});
	});

	$effect(() => {
		prodsFromSrcPromises.forEach((prodsFromSrcPromise, srcDescs) => {
			addFulfilledProdsToSrc(srcDescs, prodsFromSrcPromise);
		});
	});

	$effect.pre(() => {
		const descs = data.newSrcsDescriptors;
		const urlCode = page.url.searchParams.get('q') ?? '';
		untrack(() => {
			if (urlCode && urlCode !== code) code = urlCode;
		});
		const currentCode = untrack(() => (urlCode && codeRgx.test(urlCode) ? urlCode : code));
		enabledSourceCards = descs.map((srcDesc) => {
			const isDataSSRPreloaded: boolean =
				(page.url.searchParams.get(srcDesc?.sourceID ?? '') === '1' ? true : false) &&
				srcDesc.isLoggedIn !== false; //is Data loaded in SSR from URL params
			return {
				sourceDescriptors: srcDesc,
				isChecked: isDataSSRPreloaded,
				isDataLoaded: isDataSSRPreloaded,
				isMouseOverScrapingType: false,
				lastCodeQuery: isDataSSRPreloaded ? currentCode : undefined
			};
		});
	});

	afterNavigate(({ shallow }) => {
		if (shallow) return;

		disableScrollHandling();
		searchEntries = loadSearchEntries();
	});

	onMount(async () => {
		legendSlider = loadLegendSlider();
		await queryCache.open();
		// if (tableWorker === null) initTableWorker();
		// onDestroy(() => {
		// 	if (tableWorker) tableWorker.terminate();
		// });
	});

	onDestroy(() => {
		if (legendSliderRaf) cancelAnimationFrame(legendSliderRaf);
	});
</script>

<svelte:window
	onstorage={onSearchHistoryStorage}
	onpointermove={onLegendSliderPointerMove}
	onpointerup={endLegendSliderDrag}
	onpointercancel={endLegendSliderDrag}
/>

<svelte:head>
	<title>ff [{code}] {isLoadingTable ? '⏳' : ''}</title>
</svelte:head>
<!-- <Toaster /> -->

<nav class="flex justify-end gap-4 border-b border-secondary/5 bg-secondary/5 px-12 pt-2 pb-1">
	{#each enabledSourceCards.filter((s) => typeof s.sourceDescriptors.isLoggedIn === 'boolean') as sessionSC (sessionSC.sourceDescriptors.sourceID)}
		<SrcSessionForm
			sourceDescriptors={sessionSC.sourceDescriptors}
			formActionData={form}
			class="border border-secondary/20 text-secondary/60"
		/>
	{/each}
</nav>
<main class="mx-auto w-full bg-primary/5">
	<div
		class="flex flex-wrap items-center gap-x-4 gap-y-2 px-8 pt-6 pb-4 text-sm text-primary lg:px-12"
	>
		<span class="inline-flex items-center gap-1.5">
			<span
				class="query-chip-title inline-flex shrink-0 items-center"
				style:anchor-name="--cached-queries"
				role="img"
				aria-label="cached queries in your machine"
			>
				<DatabaseZap size={16} aria-hidden="true" />
			</span>
			<span class="query-chip-tooltip" role="tooltip" style:position-anchor="--cached-queries">
				cached queries in your machine
			</span>
			<span class="font-bold tabular-nums">{queryCache.queryCount}</span>
		</span>
		<span class="text-primary/80 tabular-nums">{formatCacheSize(queryCache.byteSize)}</span>
		<button
			type="button"
			class="cursor-pointer border border-primary/60 px-2 py-0.5 text-xs hover:bg-primary/80 hover:text-background"
			onclick={() => queryCache.purge()}
		>
			Purge cache
		</button>
	</div>
	<form
		method="GET"
		bind:this={searchForm}
		onsubmit={recordCurrentSearch}
		class="mb-4 flex max-w-full min-w-0 flex-col content-center justify-around pb-5"
	>
		<fieldset
			class="search-fieldset bg-grid flex w-full max-w-full min-w-0 flex-col gap-4 border-y border-primary/50 bg-primary/10 px-8 pt-2 pb-8 lg:px-12"
		>
			<legend
				class="search-legend relative flex w-full max-w-full min-w-0 items-center gap-6 px-2 text-xs opacity-80 select-none"
			>
				<!-- <span>search</span> -->
				{@render queryChips(
					'Most recent queries',
					'--recent-queries',
					ListClock,
					recentQueries,
					legendSlider
				)}
				<button
					type="button"
					class="absolute top-1/2 z-30 w-4 -translate-y-1/2 cursor-ew-resize touch-none border-0 bg-transparent p-0 text-inherit select-none"
					style:left={`calc(${legendSlider} * (100% - 16px))`}
					aria-label="slider"
					role="slider"
					aria-orientation="horizontal"
					aria-valuemin={0}
					aria-valuemax={1}
					aria-valuenow={legendSlider}
					onpointerdown={onLegendSliderPointerDown}
					onkeydown={onLegendSliderKeydown}
				>
					<GripVertical size={16} aria-hidden="true" />
				</button>
				{@render queryChips(
					'Most frequent queries',
					'--frequent-queries',
					ChartPie,
					frequentQueries,
					frequentChipWidth
				)}
			</legend>
			<div class="flex flex-col gap-8 pt-2"></div>
			<div class="flex w-full items-center gap-4">
				<input
					name="q"
					bind:value={code}
					type="text"
					placeholder="code"
					minlength={3}
					maxlength={32}
					pattern={`[\\w.\\-\\/]{3,32}`}
					oninput={checkOutdatedSourceData}
					required
					class="text-md w-full border border-primary/80 bg-background px-2 text-lg font-bold placeholder-primary/50 ring-primary/50 ring-offset-background focus-visible:ring-3 focus-visible:ring-offset-8 focus-visible:outline-hidden"
				/>
				<button
					type="submit"
					aria-label="search"
					class="h-full cursor-pointer border border-primary/80 px-2 transition-colors hover:bg-primary/80 hover:text-background active:border-primary active:bg-primary active:text-background"
				>
					<Search size={20} />
				</button>
			</div>
		</fieldset>

		<fieldset
			disabled={!codeRgx.test(code)}
			class="flex min-w-44 flex-wrap content-center gap-3 px-8 pt-7 pb-8 shadow-[0_3px_0_0] shadow-primary/5 lg:px-12"
		>
			{#each enabledSourceCards.filter((s) => s.sourceDescriptors.isLoggedIn === false || !s.isChecked) as disabledSC (disabledSC.sourceDescriptors.sourceID)}
				<div
					class={[
						'flex grow flex-col gap-px bg-background transition-shadow',
						disabledSC.isMouseOverScrapingType &&
							scrapingTypeColors.get(disabledSC.sourceDescriptors.scrapingType)?.style.shadow.bottom
					]}
					in:receive={{ key: disabledSC.sourceDescriptors.sourceID }}
					out:send={{ key: disabledSC.sourceDescriptors.sourceID }}
					animate:flip={{ duration: 300 }}
				>
					{const metadataPromise = $derived(
						sourceCardsMetadataPromises.get(disabledSC.sourceDescriptors.sourceID)
					)}
					<SourceCard
						sourceDescriptors={disabledSC.sourceDescriptors}
						metaDataPromise={metadataPromise}
						{loadInitialProducts}
						{loadNextProducts}
						{refreshCachedQuery}
						bind:isChecked={disabledSC.isChecked}
						bind:isDataLoaded={disabledSC.isDataLoaded}
						lastCodeQuery={disabledSC.lastCodeQuery}
					/>
					<span
						class="h-ps {scrapingTypeColors.get(disabledSC.sourceDescriptors.scrapingType)?.style
							.bg} {disabledSC.sourceDescriptors.isLoggedIn === false ? 'opacity-20' : ''}"
					></span>
				</div>
			{/each}
		</fieldset>

		<fieldset
			disabled={!codeRgx.test(code)}
			class="relative z-20 flex font-medium disabled:opacity-50"
		>
			<ButtonsByScrapingType {enabledSourceCards} />
		</fieldset>
		<fieldset
			disabled={!codeRgx.test(code)}
			class="flex basis-auto flex-wrap content-center justify-center gap-4 border-b border-secondary/20 px-8 pt-8 pb-10 shadow-[0_-3px_0_0] shadow-primary/5 lg:px-12"
		>
			{#each enabledSourceCards.filter((s) => s.isChecked) as enabledSC (enabledSC.sourceDescriptors.sourceID)}
				<div
					class={[
						'transition-shadow',
						enabledSC.isMouseOverScrapingType
							? scrapingTypeColors.get(enabledSC.sourceDescriptors.scrapingType)?.style.shadow.top
							: 'bg-background'
					]}
					in:receive={{ key: enabledSC.sourceDescriptors.sourceID }}
					out:send={{ key: enabledSC.sourceDescriptors.sourceID }}
					animate:flip={{ duration: 300 }}
				>
					{const metadataPromise = $derived(
						sourceCardsMetadataPromises.get(enabledSC.sourceDescriptors.sourceID)
					)}
					<SourceCard
						sourceDescriptors={enabledSC.sourceDescriptors}
						metaDataPromise={metadataPromise}
						{loadInitialProducts}
						{loadNextProducts}
						{refreshCachedQuery}
						bind:isChecked={enabledSC.isChecked}
						bind:isDataLoaded={enabledSC.isDataLoaded}
						lastCodeQuery={enabledSC.lastCodeQuery}
					/>
				</div>
			{/each}
		</fieldset>
	</form>

	<section class="bg-se px-4 pb-4 lg:px-12 lg:pb-12">
		{#if isLoadingTable}
			loading
		{/if}

		{#if productsOfTable.length > 0}
			{#if isLoadingMoreProductsOnTable}
				<p class="mb-2">loading</p>
			{/if}
			<DataTable products={productsOfTable} />
		{/if}
	</section>
</main>

{#snippet queryChips(
	tooltip: string,
	anchorName: string,
	Icon: Component,
	entries: SearchEntry[],
	widthFactor: number
)}
	<div
		class="flex min-w-0 flex-nowrap items-center gap-x-3 overflow-x-auto overflow-y-hidden"
		style:width={`${widthFactor * 100}%`}
	>
		<button
			type="button"
			class="query-chip-title inline-flex shrink-0 items-center opacity-80"
			style:anchor-name={anchorName}
			aria-label={tooltip}
		>
			<Icon size={16} aria-hidden="true" />
		</button>
		<span class="query-chip-tooltip" role="tooltip" style:position-anchor={anchorName}>
			{tooltip}
		</span>
		{#each entries as entry (entry.q)}
			<button
				type="button"
				class={[
					'cursor-pointer border px-2 py-0.5 text-sm whitespace-nowrap transition-colors hover:bg-primary/80 hover:text-background',
					code === entry.q ? 'border-primary bg-primary/20' : 'border-primary/50 bg-background'
				]}
				onclick={() => searchFromEntry(entry)}
			>
				{entry.q}
			</button>
		{/each}
	</div>
{/snippet}

<style>
	.search-fieldset {
		min-width: 0;
		max-width: 100%;
	}

	.search-legend {
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.bg-grid {
		--line-mix: color-mix(in oklch, transparent, var(--color-primary) 6%) 2px;
		background-image:
			linear-gradient(to right, var(--line-mix), transparent 1px),
			linear-gradient(to bottom, var(--line-mix), transparent 1px);
		background-size: 10px 10px;
	}

	.query-chip-title {
		border: none;
		background: transparent;
		padding: 0;
		cursor: help;
		color: inherit;
	}

	.query-chip-tooltip {
		position: absolute;
		z-index: 40;
		bottom: anchor(top);
		left: anchor(right);
		margin: 0 0 0.35rem 0.35rem;
		position-try-fallbacks: flip-block, flip-inline;
		pointer-events: none;
		white-space: nowrap;
		border: 1px solid color-mix(in oklch, var(--color-primary) 50%, transparent);
		background: var(--color-background);
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		color: var(--color-primary);
		opacity: 0;
		visibility: hidden;
		transition: opacity 0.15s ease;
	}

	.query-chip-title:is(:hover, :focus-visible) + .query-chip-tooltip {
		opacity: 1;
		visibility: visible;
	}
</style>
