<script lang="ts">
	import type { Action } from 'svelte/action';
	import { LoaderCircle, Antenna, ListPlus, File, ArrowRightLeft } from '@lucide/svelte';
	import { scrapingTypeColors } from '$lib/scarpingTypes';

	let {
		sourceDescriptors,
		metaDataPromise,
		loadInitialProducts,
		loadNextProducts,
		updateTable, // removes products from table checking enabled source cards
		isChecked = $bindable(),
		isDataLoaded = $bindable(),
		lastCodeQuery
	}: {
		sourceDescriptors: SourceDescriptors;
		metaDataPromise: Promise<MetaData> | undefined;
		loadNextProducts: (sourceID: string) => Promise<void>;
		loadInitialProducts: (sourceID: string) => Promise<void>;
		updateTable: () => void;
		isChecked: boolean;
		isDataLoaded: boolean;
		lastCodeQuery: string | null;
	} = $props();

	let isError = $state(false);
	let isLoadingNextProducts = $state(false);

	async function handleSCClick(e: Event) {
		e.preventDefault();
		if (sourceDescriptors.isLoggedIn === false) return;
		isChecked = !isChecked;
		updateTable();
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

	const handleIsError: Action<HTMLElement, number | undefined> = (_node, sourceDataStatus) => {
		if (sourceDataStatus !== 200) isError = true;
	};
</script>

{#snippet loader()}
	<LoaderCircle class="col-span-2 row-span-2 animate-spin" />
	<p class="mb-2 {sourceDescriptors.banner ? 'mt-1' : 'mt-0.5'} text-muted-foreground text-xs">
		(loading)
	</p>
{/snippet}

<button
	disabled={sourceDescriptors.isLoggedIn === false}
	class="focus-visible:ring-ring grid h-full cursor-pointer content-stretch justify-center gap-y-1 border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-20
  {!isChecked || isDataLoaded ? 'border-solid' : 'border-dashed'}
  {isChecked
		? isError
			? 'text-[#00ff00]-300 grid-cols-[1rem_40px_9rem_5rem_3.5rem] grid-rows-[1fr_1rem] items-center border-orange-600 bg-orange-600/5 text-orange-400 hover:bg-neutral-600/20 hover:text-white'
			: 'text-[#00ff00]-300 grid-cols-[1rem_40px_9rem_5rem_3.5rem] grid-rows-[1fr_1rem] items-center border-primary hover:bg-primary/10'
		: 'w-full grid-cols-[1rem_1fr_1fr_1rem] grid-rows-1 items-center border-primary/70 bg-neutral-600/5 hover:bg-neutral-600/20 hover:text-white'}
  "
	onclick={handleSCClick}
>
	<span
		class=" {isChecked ? 'row-span-2 self-start' : 'self-end'} h-1 w-2 {scrapingTypeColors.get(
			sourceDescriptors.scrapingType
		)?.style.bg}"
	></span>
	<input type="checkbox" name={sourceDescriptors.sourceID} checked={isChecked} value="1" hidden />
	<img
		src={sourceDescriptors.banner ?? sourceDescriptors.logo}
		alt={sourceDescriptors.name}
		loading="lazy"
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
			{#await metaDataPromise}
				{@render loader()}
			{:then metaData}
				<samp class="mt-2 pr-2 text-start text-lg" use:handleIsError={metaData?.status}>
					{#if metaData?.status === 200}
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
				{@render buttonLoadMore(metaData)}
				<span
					class="col-span-1 mt-[0.08rem] inline-flex items-center gap-0 self-start text-[0.55rem] font-black text-secondary"
					><Antenna class="mx-0.5 inline h-2 w-2" />{metaData?.status}</span
				>
				<span class="w-11/12 text-start text-[0.55rem] font-medium text-secondary">
					{#if isDataLoaded}
						<span class="perf-text inline-flex items-center"
							><ArrowRightLeft class="mx-0.5 inline h-2 w-2" />{metaData?.performanceTimings
								?.proxyToSource} ms</span
						>
					{:else if lastCodeQuery}
						({lastCodeQuery}) ━━ OLD ━━
					{/if}
				</span>

				{#if metaData?.page && metaData?.pages}
					<samp class="mb-2 flex items-center pr-2 text-xs text-secondary/70">
						<File class="mr-1 h-3 w-3" />
						{metaData.page}{metaData.pages ? '/' + metaData.pages : ''}
					</samp>
				{/if}
			{:catch error}
				<p class="col-span-4 row-span-3 h-7 overflow-auto text-left text-xs text-red-400">
					{error.message}
				</p>
			{/await}
		{:else}
			{@render loader()}
		{/if}
	{/if}
</button>

<!-- button to load more items snipped because sevelte doesn't like buttons inside buttons (for hydratation errors) -->
{#snippet buttonLoadMore(metaData: MetaData)}
	{@const isDisabled =
		(metaData?.totalItems &&
			typeof metaData.totalItems !== 'string' &&
			metaData?.maxItemsPagination &&
			metaData?.currentItemsDisplayed < metaData?.totalItems &&
			isDataLoaded) ||
		(metaData?.pages && metaData.page < metaData.pages) ||
		typeof metaData?.totalItems === 'string' ||
		!lastCodeQuery
			? false
			: true}
	<button
		class="row-span-2 flex size-full cursor-pointer flex-col place-content-center items-center border-l border-primary bg-primary/10 hover:bg-primary/20 hover:text-primary disabled:bg-transparent disabled:bg-cover"
		style={isDisabled
			? `background-image: repeating-linear-gradient(-45deg, transparent 0 8px, var(--color-primary) 8px 16px);`
			: ''}
		onclick={(e) => {
			e.stopPropagation();
			handleLoadingNextProducts(sourceDescriptors.sourceID);
		}}
		disabled={isDisabled || isLoadingNextProducts}
	>
		{#if isLoadingNextProducts}
			<LoaderCircle class="animate-spin" />
			{#if typeof metaData?.totalItems !== 'string' && metaData?.maxItemsPagination && metaData?.totalItems && metaData.totalItems - metaData.currentItemsDisplayed < metaData.maxItemsPagination}
				{metaData.totalItems - metaData.currentItemsDisplayed}
			{:else if typeof metaData?.totalItems === 'string' && metaData?.page && metaData?.maxItemsPagination && metaData.currentItemsDisplayed >= parseInt(metaData.totalItems)}
				more
			{:else}
				{metaData?.maxItemsPagination}
			{/if}
		{:else if !isDataLoaded && lastCodeQuery}
			<span class="bg-black px-1">OLD</span>
		{:else if metaData?.maxItemsPagination && metaData?.totalItems && ((typeof metaData?.totalItems !== 'string' && metaData?.currentItemsDisplayed < metaData?.totalItems) || metaData.currentItemsDisplayed < metaData.maxItemsPagination * (metaData?.page - 1))}
			<ListPlus size={20} />
			{#if typeof metaData?.totalItems !== 'string' && metaData?.maxItemsPagination && metaData?.totalItems && metaData.totalItems - metaData.currentItemsDisplayed < metaData.maxItemsPagination}
				{metaData.totalItems - metaData.currentItemsDisplayed}
			{:else if typeof metaData?.totalItems === 'string' && metaData?.page && metaData?.maxItemsPagination && metaData.currentItemsDisplayed >= parseInt(metaData.totalItems)}
				<ListPlus size={16} />
				more
			{:else}
				{metaData?.maxItemsPagination}
			{/if}
		{:else if typeof metaData?.totalItems === 'string' || (metaData?.pages && metaData.page < metaData.pages)}
			<ListPlus size={16} />
			more
		{:else}
			<span class="bg-black px-1">FULL</span>
		{/if}
	</button>
{/snippet}

<style lang="postcss">
	.perf-text {
		word-spacing: -0.3em;
	}
</style>
