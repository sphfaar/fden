<script lang="ts">
	import { Funnel } from '@lucide/svelte';

	let { products }: { products: ProductOfTable[] } = $props();

	let searchFilterVal = $state('');
	let filter: string | null = $derived(searchFilterVal.length > 0 ? searchFilterVal.trim() : null);

	let productsFiltered = $derived<ProductOfTable[]>(
		filter
			? products.filter((p) => p.crossCode.includes(filter) || p.manufacturerCode.includes(filter))
			: products
	);
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
	{#snippet filterHighlight(strings: string[], filter: string)}
		{#each strings as str, i (i)}
			{#if i < strings.length - 1}
				{str}<span class="text-secondary text-shadow-secondary text-shadow-xs">{filter}</span>
			{:else}
				{str}
			{/if}
		{/each}
	{/snippet}
	<tbody>
		{#each productsFiltered as product, i (i)}
			{@const manCodeSplitted = filter ? product.manufacturerCode.split(filter) : null}
			{@const crossCodeSplitted = filter ? product.crossCode.split(filter) : null}
			<tr class=" {i % 2 === 0 ? 'bg-secondary/5' : ''} data-[state=selected]:bg-muted">
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					<img class="h-6 pl-4" src={product.source.image} alt={product.source.name} />
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if manCodeSplitted && filter}
						{@render filterHighlight(manCodeSplitted, filter)}
					{:else}
						{product.manufacturerCode}
					{/if}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if crossCodeSplitted && filter}
						{@render filterHighlight(crossCodeSplitted, filter)}
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
							{#each product.thumbnails as thumbnail, i (i)}
								<li>
									<img
										class="size-8 object-cover"
										height={32}
										width={32}
										src={thumbnail}
										alt={product.manufacturerCode}
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{#if product.detailsUrl}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a href={product.detailsUrl} target="_blank" rel="noopener noreferrer">🔗</a>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
