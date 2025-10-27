<script lang="ts">
	import { LoaderCircle, Antenna, ListPlus, File, ArrowRightLeft } from '@lucide/svelte';
	import { scrapingTypeColors } from '$lib/scarpingTypes';

	let {
		sourceDescriptors,
		metaDataPromise,
		loadInitialProducts,
		loadNextProducts,
		isChecked = $bindable(),
		isDataLoaded = $bindable(),
		lastCodeQuery
	}: {
		sourceDescriptors: SourceDescriptors;
		metaDataPromise: Promise<MetaData> | undefined;
		loadNextProducts: (sourceID: string) => Promise<void>;
		loadInitialProducts: (sourceID: string) => Promise<void>;
		isChecked: boolean;
		isDataLoaded: boolean;
		lastCodeQuery: string | null;
	} = $props();

	let isLoadingNextProducts = $state(false);
	let metaData = $state<MetaData | null>(null);
	let errorMessage = $state<string | null>(null);

	let nextLoadStatus = $derived.by<
		| 'full'
		| 'unknown_more'
		| 'n_more'
		| 'n_last'
		| 'loading_unknown_more'
		| 'loading_n_more'
		| 'loading_last'
		| 'old'
		| 'error'
		| null
	>(() => {
		if (!metaData) return null;

		if (isLoadingNextProducts) {
			if (
				typeof metaData.totalItems !== 'string' &&
				metaData.maxItemsPagination &&
				metaData.totalItems &&
				metaData.totalItems - metaData.currentItemsDisplayed < metaData.maxItemsPagination
			) {
				return 'loading_last';
			} else if (
				typeof metaData.totalItems === 'string' &&
				metaData.page &&
				metaData.maxItemsPagination &&
				metaData.currentItemsDisplayed >= parseInt(metaData.totalItems)
			) {
				return 'loading_unknown_more';
			} else {
				return 'loading_n_more';
			}
		} else if (!isDataLoaded && lastCodeQuery) {
			return 'old';
		} else if (
			metaData.maxItemsPagination &&
			metaData.totalItems &&
			((typeof metaData.totalItems !== 'string' &&
				metaData.currentItemsDisplayed < metaData.totalItems) ||
				(typeof metaData.totalItems === 'string' &&
					metaData.currentItemsDisplayed === metaData.maxItemsPagination * metaData.page))
		) {
			if (
				typeof metaData.totalItems !== 'string' &&
				metaData.maxItemsPagination &&
				metaData.totalItems &&
				metaData.totalItems - metaData.currentItemsDisplayed < metaData.maxItemsPagination
			) {
				return 'n_last';
			} else if (
				typeof metaData.totalItems === 'string' &&
				metaData.page &&
				metaData.maxItemsPagination &&
				metaData.currentItemsDisplayed >= parseInt(metaData.totalItems)
			) {
				return 'unknown_more';
			} else {
				return 'n_more';
			}
		} else if (metaData.pages && metaData.page < metaData.pages) {
			return 'n_more';
		} else {
			return errorMessage ? 'error' : 'full';
		}
	});

	async function handleSCClick(e: Event) {
		e.preventDefault();
		if (sourceDescriptors.isLoggedIn === false) return;
		isChecked = !isChecked;
		if (isDataLoaded) {
			return;
		} else {
			isLoadingNextProducts = true;
			isDataLoaded = true;
			await loadInitialProducts(sourceDescriptors.sourceID);
			isLoadingNextProducts = false;
		}
	}
	async function handleLoadingNextProducts(sourceID: string) {
		isLoadingNextProducts = true;
		await loadNextProducts(sourceID);
		isLoadingNextProducts = false;
	}

	async function initLoad() {
		try {
			metaData = (await metaDataPromise) ?? null;
		} catch (error) {
			if (
				error &&
				typeof error === 'object' &&
				'message' in error &&
				typeof error.message === 'string'
			) {
				errorMessage = error.message;
			} else {
				errorMessage = String(error);
			}
		}
	}

	$effect(() => {
		if (metaDataPromise) {
			initLoad();
		}
	});
</script>

<button
	disabled={sourceDescriptors.isLoggedIn === false}
	class="focus-visible:ring-ring grid h-full cursor-pointer content-stretch items-center justify-center border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-20
  {!isChecked || isDataLoaded ? 'border-solid' : 'border-dashed'}
  {isChecked
		? `source-card-checked w-xs ${
				errorMessage
					? 'border-error bg-error/5 text-error hover:bg-error/10'
					: 'border-primary hover:bg-primary/10'
			}`
		: 'grid-cols-[1rem_1fr_1fr_1rem] grid-rows-1 border-primary/70 bg-neutral-600/5 hover:bg-neutral-600/20 hover:text-white'}
  "
	onclick={handleSCClick}
>
	<!-- Scraping Type Color -->
	<span
		class=" {isChecked ? 'row-span-2 self-start' : 'self-end'} h-1 w-2 {scrapingTypeColors.get(
			sourceDescriptors.scrapingType
		)?.style.bg}"
	></span>

	<!-- Source Logo or Logo + Name -->
	<img
		src={sourceDescriptors.banner ?? sourceDescriptors.logo}
		alt={sourceDescriptors.name}
		class={sourceDescriptors.banner
			? isChecked
				? 'col-span-2 mt-2 h-6'
				: 'col-span-2 my-2 h-6 justify-self-center'
			: isChecked
				? 'mt-2 h-6'
				: 'h-6'}
	/>
	{#if !sourceDescriptors.banner}
		<h3 class="text-start text-lg font-bold {isChecked ? 'mt-1.5' : ''}">
			{sourceDescriptors.name}
		</h3>
	{/if}

	{#if isChecked}
		{#if metaDataPromise}
			{#if metaData}
				<!-- N.Items/Total or error message -->
				<samp class="mt-2 ml-4 pr-2 text-end text-lg">
					{#if !errorMessage}
						{#if metaData?.maxItemsPagination && metaData?.totalItems}
							<span class="font-bold">{metaData.currentItemsDisplayed}</span><span class="text-xs"
								>/{metaData.totalItems}
							</span>
						{:else}
							<span class="font-bold">{metaData?.currentItemsDisplayed}</span>
						{/if}
					{:else}
						<span class="bold"
							>{metaData?.status && metaData?.status >= 500
								? 'failed'
								: metaData?.status && metaData?.status >= 400
									? 'rejected'
									: 'error'}</span
						>
					{/if}
				</samp>

				<!-- Progress to FULL -->
				{@render progressToFULL(
					metaData.pages && nextLoadStatus !== 'full' ? metaData.page / metaData.pages : 1,
					metaData.pages
						? { fill: 'var(--color-secondary)' }
						: { stroke: 'var(--color-secondary)' },
					'size-full row-span-2 h-11 ml-1 w-1.5 opacity-60'
				)}

				<!-- Loading More Button -->
				{@render buttonLoadMore(metaData ?? undefined)}
			{:else if errorMessage}
				<p class="col-span-1 row-span-2 ml-4 h-7 overflow-auto text-left text-xs text-error">
					{errorMessage}
				</p>
				{@render progressToFULL(
					1,
					{ stroke: 'var(--color-error)' },
					'size-full row-span-2 h-11 ml-1 w-1.5 opacity-65'
				)}
				{@render buttonError()}
			{/if}

			<!-- Stats -->
			<span
				class="col-span-1 mt-[0.08rem] inline-flex items-center gap-0 self-start text-[0.55rem] font-black {errorMessage
					? 'text-inherit'
					: 'text-secondary'}"><Antenna class="mx-0.5 inline h-2 w-2" />{metaData?.status}</span
			>
			<span
				class="w-11/12 text-start text-[0.55rem] font-medium {errorMessage
					? 'hidden'
					: 'text-secondary'}"
			>
				{#if isDataLoaded}
					<span class="perf-text inline-flex items-center text-nowrap"
						><ArrowRightLeft class="mx-0.5 inline h-2 w-2" />{metaData?.performanceTimings
							?.proxyToSource} ms</span
					>
				{:else if lastCodeQuery}
					({lastCodeQuery}) ━━ OLD ━━
				{/if}
			</span>

			<!-- N. Pages -->
			{#if metaData?.page && metaData?.pages}
				<samp class="mb-2 flex items-center justify-end pr-2 text-xs text-secondary/70">
					<File class="mr-1 h-3 w-3" />
					{metaData.page}{metaData.pages ? '/' + metaData.pages : ''}
				</samp>
			{/if}
		{:else}
			{@render loader(sourceDescriptors.banner ? true : false)}
		{/if}
	{/if}

	<input type="checkbox" name={sourceDescriptors.sourceID} checked={isChecked} value="1" hidden />
</button>

<!-- button to load more items snipped because sevelte doesn't like buttons inside buttons (for hydratation errors) -->
{#snippet buttonLoadMore(metaData: MetaData)}
	{@const isDisabled =
		(metaData.totalItems &&
			typeof metaData.totalItems !== 'string' &&
			metaData.maxItemsPagination &&
			metaData.currentItemsDisplayed < metaData.totalItems &&
			isDataLoaded) ||
		(metaData.pages && metaData.page < metaData.pages) ||
		typeof metaData.totalItems === 'string' ||
		!lastCodeQuery
			? false
			: true}
	<button
		class="row-span-2 flex size-full cursor-pointer flex-col place-content-center items-center border-l border-primary bg-primary/10 hover:bg-primary/20 hover:text-primary disabled:bg-transparent disabled:bg-cover disabled:opacity-70"
		style={isDisabled
			? `background-image: repeating-linear-gradient(-45deg, transparent 0 8px, var(--color-primary) 8px 16px);`
			: ''}
		onclick={(e) => {
			e.stopPropagation();
			handleLoadingNextProducts(sourceDescriptors.sourceID);
		}}
		disabled={isDisabled || isLoadingNextProducts}
	>
		{#if nextLoadStatus}
			{#if nextLoadStatus.startsWith('loading_')}
				<LoaderCircle class="animate-spin" />
				{#if typeof metaData.totalItems === 'number' && nextLoadStatus === 'loading_last'}
					{metaData.totalItems - metaData.currentItemsDisplayed}
				{:else if nextLoadStatus === 'loading_unknown_more'}
					more
				{:else if nextLoadStatus === 'loading_n_more'}
					{#if metaData.maxItemsPagination}
						{metaData.maxItemsPagination}
					{:else}
						more
					{/if}
				{/if}
			{:else if nextLoadStatus === 'old'}
				<span class="bg-black px-1">OLD</span>
			{:else if typeof metaData.totalItems === 'number' && nextLoadStatus === 'n_last'}
				<ListPlus size={20} />
				{metaData.totalItems - metaData.currentItemsDisplayed}
			{:else if nextLoadStatus === 'unknown_more'}
				<ListPlus size={16} />
				more
			{:else if nextLoadStatus === 'n_more'}
				{#if metaData.maxItemsPagination}
					<ListPlus size={20} />
					{metaData.maxItemsPagination}
				{:else}
					<ListPlus size={16} />
					more
				{/if}
			{:else if nextLoadStatus === 'error'}
				<span class="bg-black px-1 font-bold">ERR.</span>
			{:else if nextLoadStatus === 'full'}
				<span class="bg-black px-1 font-bold">FULL</span>
			{/if}
		{/if}
	</button>
{/snippet}

{#snippet buttonError()}
	<button
		class="row-span-2 flex size-full cursor-pointer flex-col place-content-center items-center border-l border-error bg-error/10 hover:bg-error/20 hover:text-error"
		style="background-image:repeating-linear-gradient(-45deg, transparent 0 8px, var(--color-error) 8px 34px);"
		onclick={(e) => {
			e.stopPropagation();
			handleLoadingNextProducts(sourceDescriptors.sourceID);
		}}
		disabled={isLoadingNextProducts}
	>
		<span class="bg-black px-1 font-bold">{errorMessage ? 'ERR.' : 'FULL'}</span>
	</button>
{/snippet}

<!-- Progress to total/FULL svg -->
{#snippet progressToFULL(
	progress: number,
	opts: { fill?: string; stroke?: string },
	className?: string
)}
	{@const containerHeight = 50}
	{@const totalRects = 8}
	{@const numFilled = Math.floor(totalRects * progress)}
	{@const gap = 4}
	{@const rectHeight = containerHeight / totalRects - gap}
	<svg
		class={className}
		viewBox="0 0 20 {containerHeight}"
		preserveAspectRatio="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<g transform="matrix(1 0 0 -1 0 {containerHeight})">
			{#each { length: numFilled }, i}
				<rect
					x="0"
					y={(rectHeight + gap) * i + gap / 2}
					width="20"
					height={rectHeight}
					fill={opts.fill}
					stroke={opts.stroke}
				/>
			{/each}
		</g>
	</svg>
{/snippet}

{#snippet loader(enabled: boolean)}
	<p class="col-span-2 row-span-2 mb-2 {enabled ? 'mt-1' : 'mt-0.5'} text-muted-foreground text-xs">
		(loading)
	</p>
	<LoaderCircle class="row-span-2 animate-spin" />
{/snippet}

<style lang="postcss">
	.source-card-checked {
		grid-template-columns: 1rem 40px auto 1fr 1rem 3.5rem;
		grid-template-rows: 1fr 1rem;
	}
	.perf-text {
		word-spacing: -0.3em;
	}
</style>
