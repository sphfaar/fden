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

	const codeRgx = /^[\w.\-/]{3,32}$/;
	let code = $state(page.url.searchParams.get('q') ?? '');
	let isLoadingTable: boolean | null = $state(null);
	let isLoadingMoreProductsOnTable = $state(false);

	const prodsFromSrcPromises: ProductsFromSourcePromises = new SvelteMap(); //products will be added here also by APIs

	const prodsFromSrcFulfilled: ProductsFromSources = new WeakMap();

	let productsOfTable: ProductOfTable[] = $state([]);

	let enabledSourceCards: EnabledSourceCard[] = $state(
		data.newSrcsDescriptors.map((srcDesc) => {
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
		})
	);

	let sourceCardsMetadataPromises = $derived(
		new SvelteMap<string, Promise<MetaData> | undefined>(
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

	let nTotalResults = $derived(productsOfTable.length > 0 ? productsOfTable.length : null);

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
			body: JSON.stringify({ sourceID, code })
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
				body: JSON.stringify({ sourceID, meta, code })
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

	function updateProductsOfTable(
		prodsFromSrcPromises: ProductsFromSourcePromises,
		prodsFromSrcFulfilled: ProductsFromSources
	) {
		const newPot: ProductOfTable[] = [];
		prodsFromSrcPromises.forEach((prodsData, srcDescs) => {
			const newProdsData = prodsFromSrcFulfilled.get(prodsData)?.productsData;
			if (!srcDescs || !isSourceCardChecked(srcDescs.sourceID) || !newProdsData) return;
			newPot.push(
				...newProdsData.products.map((product) => {
					return {
						source: {
							name: srcDescs.name,
							image: srcDescs.logo ?? srcDescs.banner
						},
						manufacturerCode: product.manufacturer_code,
						crossCode: product.source_reference_code,
						manufacturerName: product.manufacturer,
						detailsUrl: product.detailsUrl,
						thumbnails: product.thumbnails
					};
				})
			);
		});
		productsOfTable = newPot;
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
		updateProductsOfTable(prodsFromSrcPromises, prodsFromSrcFulfilled);
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
	<title>f.den [{code}] {isLoadingTable ? '⏳' : ''}</title>
</svelte:head>
<!-- <ModeWatcher track={false} defaultMode="dark" /> -->
<!-- <Toaster /> -->

<nav
	class="flex flex-col content-center justify-around border-b-2 border-primary/50 bg-primary/20 px-12 py-2"
>
	{#each enabledSourceCards.filter((s) => typeof s.sourceDescriptors.isLoggedIn === 'boolean') as sessionSC (sessionSC.sourceDescriptors.sourceID)}
		<SrcSessionForm sourceDescriptors={sessionSC.sourceDescriptors} formActionData={form} />
	{/each}
</nav>
<main class="mx-auto w-full">
	<form method="GET" class="mb-4 flex flex-col content-center justify-around pb-5">
		<fieldset class="flex w-full gap-2 border-b border-primary/50 bg-primary/5 px-8 py-7 lg:px-12">
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
				class="text-md col-span-3 w-full border border-primary px-2 placeholder-primary/50"
			/>
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
							? [
									scrapingTypeColors.get(disabledSC.sourceDescriptors.scrapingType)?.style.shadow
										.bottom,
									scrapingTypeColors.get(disabledSC.sourceDescriptors.scrapingType)?.style.bg,
									'bg-opacity-5'
								]
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
						updateTable={() => updateProductsOfTable(prodsFromSrcPromises, prodsFromSrcFulfilled)}
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
			<ButtonsByScrapingType bind:enabledSourceCards />
		</fieldset>
		<fieldset
			disabled={!codeRgx.test(code)}
			class="300/40 flex basis-auto flex-wrap content-center justify-center gap-4 border-b px-8 pt-8 pb-10 shadow-[0_-3px_0_0] shadow-primary/5 lg:px-12"
		>
			{#each enabledSourceCards.filter((s) => s.isChecked) as enabledSC (enabledSC.sourceDescriptors.sourceID)}
				{@const metadataPromise = sourceCardsMetadataPromises.get(
					enabledSC.sourceDescriptors.sourceID
				)}
				<label
					class={[
						'flex h-fit w-fit flex-col gap-px transition-shadow',
						enabledSC.isMouseOverScrapingType
							? [
									scrapingTypeColors.get(enabledSC.sourceDescriptors.scrapingType)?.style.shadow
										.top,

									scrapingTypeColors.get(enabledSC.sourceDescriptors.scrapingType)?.style.bg,
									'bg-opacity-5'
								]
							: 'bg-opacity-100'
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
						updateTable={() => updateProductsOfTable(prodsFromSrcPromises, prodsFromSrcFulfilled)}
						bind:isChecked={enabledSC.isChecked}
						bind:isDataLoaded={enabledSC.isDataLoaded}
						lastCodeQuery={enabledSC.lastCodeQuery}
					/>
				</label>
			{/each}
		</fieldset>
	</form>

	<section class="px-4 lg:px-12">
		{#if isLoadingTable}
			loading
		{/if}

		{#if productsOfTable.length > 0}
			<p class="mb-2">
				Total filters: <b>{nTotalResults}</b>
				{#if isLoadingMoreProductsOnTable}
					loading
				{/if}
			</p>
			<DataTable
				products={productsOfTable}
				maxRows={parseInt(page.url.searchParams.get('maxRows') ?? '255')}
			/>
		{/if}
	</section>
</main>
