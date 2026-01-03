<script lang="ts">
	import '../app.css';
	import { error } from '@sveltejs/kit';
	import { onMount, /*onDestroy,*/ untrack } from 'svelte';
	// import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { disableScrollHandling, afterNavigate } from '$app/navigation';
	import { quintOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import ButtonsByScrapingType from '$lib/components/ButtonsByScrapingType.svelte';
	import SourceCard from '$lib/components/SourceCard.svelte';
	import DataTable from '$lib/components/dataTable/DataTable.svelte';
	import SrcSessionForm from '$lib/components/SrcSessionForm.svelte';
	import { scrapingTypeColors } from '$lib/scarpingTypes';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PageProps } from './$types';
	import { Search } from '@lucide/svelte';

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
	let isLoadingTable: boolean | null = $state(null);
	let isLoadingMoreProductsOnTable = $state(false);

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
					thumbnails: product.thumbnails
				});
			}
		}
		return pot;
	});

	let enabledSourceCards: EnabledSourceCard[] = $state([]);

	let sourceCardsMetadataPromises = $derived(
		new Map<string, Promise<MetaData> | undefined>(
			enabledSourceCards.map((enabledSC) => {
				const pfspSrcDescsKey = prodsFromSrcPromises
					.keys()
					.find((srcDescs) => srcDescs.sourceID === enabledSC.sourceDescriptors.sourceID);
				if (prodsFromSrcPromises && pfspSrcDescsKey) {
					const metaDataPromise: Promise<MetaData> | undefined = prodsFromSrcPromises
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

	function isSourceCardChecked(sourceID: string) {
		return enabledSourceCards.find((enabledSC) => enabledSC.sourceDescriptors.sourceID === sourceID)
			?.isChecked;
	}

	// async function initTableWorker() {
	// 	if (browser && window.Worker) {
	// 		const Worker = await import('$lib/tableWorker?worker');
	// 		if (!Worker) error(500, 'worker creation error on page');
	// 		tableWorker = new Worker.default();
	// 	}
	// }

	async function loadInitialProducts(sourceID: string): Promise<void> {
		const sourceDescs = data.newSrcsDescriptors.find((srcDesc) => srcDesc.sourceID === sourceID);
		isLoadingMoreProductsOnTable = true;
		const enabledSC = enabledSourceCards.find((src) => src.sourceDescriptors.sourceID === sourceID);
		if (enabledSC) {
			enabledSC.lastCodeQuery = code;
			enabledSC.isDataLoaded = true;
		}
		enabledSourceCards.forEach((enabledSC) => {
			if (
				enabledSC.isChecked &&
				enabledSC.lastCodeQuery !== code &&
				!enabledSC.isDataLoaded &&
				enabledSC.sourceDescriptors.isLoggedIn !== false
			)
				loadInitialProducts(enabledSC.sourceDescriptors.sourceID);
		});
		const response = await fetch('/api/getNewProducts', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ sourceID, code, maxItems: maxItemsPerSrc })
		});
		if (!response) error(500, 'error fetching new products for initial load on page');
		const responseData: Promise<ProductsData> = response.json();
		if (sourceDescs) prodsFromSrcPromises.set(sourceDescs, responseData);
		isLoadingMoreProductsOnTable = false;
	}

	async function loadNextProducts(sourceID: string) {
		if (!prodsFromSrcPromises) return;
		isLoadingMoreProductsOnTable = true;
		const srcDescs = prodsFromSrcPromises.keys().find((srcDescs) => srcDescs.sourceID === sourceID);
		const oldScProdsData: ProductsData | undefined = srcDescs
			? await prodsFromSrcPromises.get(srcDescs)
			: undefined;
		if (!oldScProdsData) return;
		const { meta, products } = oldScProdsData;
		try {
			const response = await fetch('/api/getNextProducts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ sourceID, meta, code, maxItems: maxItemsPerSrc })
			});
			if (!response) error(500, 'error loading next products on page');
			const responseData: ProductsData = await response.json();
			const newProductsData: ProductsData = {
				meta: {
					...responseData.meta,
					currentItemsDisplayed:
						meta.currentItemsDisplayed + responseData.meta.currentItemsDisplayed
				},
				products: products.concat(responseData.products)
			};

			if (srcDescs) prodsFromSrcPromises.set(srcDescs, Promise.resolve(newProductsData));
		} catch (error) {
			console.error(error);
		} finally {
			isLoadingMoreProductsOnTable = false;
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

	function updateSourceCardsLoadedStatsAfterSubmit() {
		for (let i = 0; i < enabledSourceCards.length; i++) {
			if (
				page.url.searchParams.has(enabledSourceCards[i].sourceDescriptors.sourceID) &&
				enabledSourceCards[i].sourceDescriptors.isLoggedIn !== false
			) {
				enabledSourceCards[i].lastCodeQuery = code;
				enabledSourceCards[i].isDataLoaded = true;
			}
		}
	}

	async function addFulfilledProdsToSrc(
		sourceDescs: SourceDescriptors,
		prodsDataPromise: Promise<ProductsData>
	) {
		isLoadingTable = true;
		prodsFromSrcFulfilled.set(prodsDataPromise, {
			sourceDescriptors: sourceDescs,
			productsData: await prodsDataPromise
		});
		isLoadingTable = false;
	}

	$effect(() => {
		if (data.prodsFromSrcPromises) {
			prodsFromSrcPromises.clear();
			data.prodsFromSrcPromises.forEach((prodsData, sourceDescs) => {
				prodsFromSrcPromises.set(sourceDescs, prodsData);
			});
			untrack(() => {
				updateSourceCardsLoadedStatsAfterSubmit();
			});
		}
	});

	$effect(() => {
		prodsFromSrcPromises.forEach((prodsFromSrcPromise, srcDescs) => {
			addFulfilledProdsToSrc(srcDescs, prodsFromSrcPromise);
		});
	});

	$effect.pre(() => {
		const descs = data.newSrcsDescriptors;
		enabledSourceCards = descs.map((srcDesc) => {
			const isDataSSRPreloaded: boolean =
				(page.url.searchParams.get(srcDesc?.sourceID ?? '') === '1' ? true : false) &&
				srcDesc.isLoggedIn !== false; //is Data loaded in SSR from URL params
			return {
				sourceDescriptors: srcDesc,
				isChecked: isDataSSRPreloaded,
				isDataLoaded: isDataSSRPreloaded,
				isMouseOverScrapingType: false,
				lastCodeQuery: isDataSSRPreloaded ? code : null
			};
		});
	});

	onMount(async () => {
		// if (tableWorker === null) initTableWorker();
		afterNavigate(() => {
			disableScrollHandling();
		});
		// onDestroy(() => {
		// 	if (tableWorker) tableWorker.terminate();
		// });
	});
</script>

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
<main class="mx-auto w-full bg-primary/5 pt-6">
	<form method="GET" class="mb-4 flex flex-col content-center justify-around pb-5">
		<fieldset
			class="bg-grid flex w-full items-center gap-4 border-y border-primary/50 bg-primary/10 px-8 pt-4 pb-6 lg:px-12"
		>
			<legend class="px-2 text-xs opacity-80">cross reference</legend>
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
				class="text-md w-full border border-primary/80 bg-background px-2 text-lg font-bold placeholder-primary/50 ring-primary/50 ring-offset-background focus-visible:ring focus-visible:ring-offset-8 focus-visible:outline-none"
			/>
			<button
				type="submit"
				class="h-full cursor-pointer border border-primary/80 px-2 transition-colors hover:bg-primary/80 hover:text-background active:border-primary active:bg-primary active:text-background"
			>
				<Search size={20} />
			</button>
		</fieldset>

		<fieldset
			disabled={!codeRgx.test(code)}
			class="flex min-w-44 flex-wrap content-center gap-3 px-8 pt-7 pb-8 shadow-[0_3px_0_0] shadow-primary/5 lg:px-12"
		>
			{#each enabledSourceCards.filter((s) => s.sourceDescriptors.isLoggedIn === false || !s.isChecked) as disabledSC (disabledSC.sourceDescriptors.sourceID)}
				{@const metadataPromise = sourceCardsMetadataPromises.get(
					disabledSC.sourceDescriptors.sourceID
				)}
				<div
					class={[
						'flex grow flex-col gap-px bg-background transition-shadow',
						disabledSC.isMouseOverScrapingType
							? scrapingTypeColors.get(disabledSC.sourceDescriptors.scrapingType)?.style.shadow
									.bottom
							: 'bg-opacity-100'
					]}
					in:receive={{ key: disabledSC.sourceDescriptors.sourceID }}
					out:send={{ key: disabledSC.sourceDescriptors.sourceID }}
					animate:flip={{ duration: 300 }}
				>
					<SourceCard
						sourceDescriptors={disabledSC.sourceDescriptors}
						metaDataPromise={metadataPromise}
						{loadInitialProducts}
						{loadNextProducts}
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

		<fieldset disabled={!codeRgx.test(code)} class="disabled:muted relative z-20 flex font-medium">
			<ButtonsByScrapingType {enabledSourceCards} />
		</fieldset>
		<fieldset
			disabled={!codeRgx.test(code)}
			class="flex basis-auto flex-wrap content-center justify-center gap-4 border-b border-secondary/20 px-8 pt-8 pb-10 shadow-[0_-3px_0_0] shadow-primary/5 lg:px-12"
		>
			{#each enabledSourceCards.filter((s) => s.isChecked) as enabledSC (enabledSC.sourceDescriptors.sourceID)}
				{@const metadataPromise = sourceCardsMetadataPromises.get(
					enabledSC.sourceDescriptors.sourceID
				)}
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
					<SourceCard
						sourceDescriptors={enabledSC.sourceDescriptors}
						metaDataPromise={metadataPromise}
						{loadInitialProducts}
						{loadNextProducts}
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

<style>
	.bg-grid {
		--line-mix: color-mix(in oklch, transparent, var(--color-primary) 6%) 2px;
		background-image:
			linear-gradient(to right, var(--line-mix), transparent 1px),
			linear-gradient(to bottom, var(--line-mix), transparent 1px);
		background-size: 10px 10px;
	}
</style>
