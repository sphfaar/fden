<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { catalogHttpsUrls } from '#lib/safeCatalogUrl.js';

	let {
		urls,
		onOpen
	}: {
		urls?: string[];
		onOpen: (url: string) => void;
	} = $props();

	const images = $derived(catalogHttpsUrls(urls));
	let index = $state(0);
	// A shorter list keeps the last image instead of an empty frame.
	const shown = $derived(images.length === 0 ? 0 : Math.min(index, images.length - 1));
	const current = $derived(images[shown]);
	const multiple = $derived(images.length > 1);

	function step(delta: number) {
		const next = shown + delta;
		if (next < 0 || next >= images.length) return;
		index = next;
	}
</script>

{#if current}
	<div class="relative inline-flex w-max items-center">
		{#if multiple}
			<button
				type="button"
				class="absolute top-[-100vh] bottom-[-100vh] left-0 z-10 flex w-5 items-center justify-center text-primary/70 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
				aria-label="Previous thumbnail"
				disabled={shown === 0}
				onclick={() => step(-1)}
			>
				<ChevronLeft size={14} />
			</button>
		{/if}
		<div class={['relative shrink-0', multiple && 'mx-5']}>
			<button
				type="button"
				class="relative block w-max shrink-0 cursor-pointer border border-primary/30 bg-white p-0.5 leading-none hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
				aria-label={multiple
					? `Expand thumbnail ${shown + 1} of ${images.length}`
					: 'Expand thumbnail'}
				onclick={() => onOpen(current)}
			>
				<img
					src={current}
					alt=""
					loading="lazy"
					decoding="async"
					width="32"
					height="32"
					class="block size-8 max-w-none shrink-0 object-contain"
				/>
				{#if multiple}
					<span
						class="pointer-events-none absolute inset-x-px bottom-px text-right text-[10px] leading-tight tabular-nums bg-blend-color"
						aria-hidden="true">{shown + 1}/{images.length}</span
					>
				{/if}
			</button>
		</div>
		{#if multiple}
			<button
				type="button"
				class="absolute top-[-100vh] right-0 bottom-[-100vh] z-10 flex w-5 items-center justify-center text-primary/70 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
				aria-label="Next thumbnail"
				disabled={shown === images.length - 1}
				onclick={() => step(1)}
			>
				<ChevronRight size={14} />
			</button>
		{/if}
	</div>
{/if}
