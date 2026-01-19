<script lang="ts">
	import { Funnel } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let { products }: { products: ProductOfTable[] } = $props();

	let searchFilterVal = $state('');
	let filter: string | null = $derived(
		searchFilterVal.length > 0 ? searchFilterVal.trim() : null
	);
	// Compute lowercase version of filter for case-insensitive searching
	let filterLower: string | null = $derived(filter ? filter.toLowerCase() : null);

	let productsFiltered = $derived<ProductOfTable[]>(
		filter
			? products.filter(
					(p) =>
						p.crossCode &&
						// Use lowercase comparisons for case-insensitive filtering
						(p.crossCode.toLowerCase().includes(filterLower!) ||
							p.manufacturerCode.toLowerCase().includes(filterLower!))
				)
			: products
	);

	let thumbnailsInProxyFallback = new SvelteSet<string>();
	let thumbnailsHidden = new SvelteSet<string>();

	interface HighlightPart {
		text: string;
		isHighlight: boolean;
	}

	function highlight(original: string, filter: string): HighlightPart[] {
		if (!filter) return [{ text: original, isHighlight: false }];

		const parts: HighlightPart[] = [];
		//  Escape special regex characters in filter to treat it as literal
		const escapedFilter = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(escapedFilter, 'gi');
		let lastIndex = 0;
		let match;
		while ((match = regex.exec(original)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ text: original.slice(lastIndex, match.index), isHighlight: false });
			}
			// Use the matched substring with its original casing for the highlight
			parts.push({ text: match[0], isHighlight: true });
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < original.length) {
			parts.push({ text: original.slice(lastIndex), isHighlight: false });
		}
		return parts;
	}
</script>

<div class="flex w-full items-center gap-2 border border-primary/50 px-2 py-1">
	<Funnel size={16} />
	<input class="w-full bg-primary/10" bind:value={searchFilterVal} />
	<samp class="font-bold">{productsFiltered.length}/{products.length}</samp>
</div>

<table class="mb-32 w-full caption-bottom text-sm">
	<thead>
		<tr
			class="border-accent-foreground/30 data-[state=selected]:bg-muted border-b transition-colors hover:bg-background"
		>
			<th
				class="text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0"
				>Source</th
			>
			<th
				class="text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0"
				>Manufacturer Code</th
			>
			<th
				class="text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0"
				>Cross Code</th
			>
			<th
				class="text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0"
				>Manufacturer Name</th
			>
		</tr>
	</thead>
	{#snippet filterHighlight(str: string, filter: string)}
		{#each highlight(str, filter) as part (part)}
			{#if part.isHighlight}
				<span class="text-secondary text-shadow-secondary text-shadow-xs">{part.text}</span>
			{:else}
				{part.text}
			{/if}
		{/each}
	{/snippet}
	<tbody>
		{#each productsFiltered as product, i (i)}
			<tr class=" {i % 2 === 0 ? 'bg-secondary/5' : ''} data-[state=selected]:bg-muted">
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					<img class="h-6 pl-4" src={product.source.image} alt="s_img" />
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if filter}
						{@render filterHighlight(product.manufacturerCode, filter)}
					{:else}
						{product.manufacturerCode}
					{/if}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if filter}
						{@render filterHighlight(product.crossCode, filter)}
					{:else}
						{product.crossCode}
					{/if}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{product.manufacturerName}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if product.thumbnails}
						<ul>
							{#each product.thumbnails as url, j (j)}
								<li class:hidden={thumbnailsHidden.has(url)}>
									<img
										src={thumbnailsInProxyFallback.has(url)
											? `/proxy?url=${encodeURIComponent(url)}`
											: url}
										loading="lazy"
										alt="p_img"
										height={32}
										width={32}
										class="size-8 object-cover"
										onerror={() => {
											// if url proxy already attempted then hide
											if (thumbnailsInProxyFallback.has(url))
												thumbnailsHidden.add(url);
											else thumbnailsInProxyFallback.add(url);
										}}
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if product.detailsUrl}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a href={product.detailsUrl} target="_blank" rel="noopener noreferrer">🔗</a
						>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
