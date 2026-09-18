<script module lang="ts">
	import {
		columnFilteringFeature,
		constructFilterFn,
		createColumnHelper,
		createFilteredRowModel,
		globalFilteringFeature,
		tableFeatures
	} from '@tanstack/svelte-table';

	const features = tableFeatures({
		columnFilteringFeature,
		globalFilteringFeature,
		filteredRowModel: createFilteredRowModel()
	});

	const columnHelper = createColumnHelper<typeof features, ProductOfTable>();

	const productCodeGlobalFilter = constructFilterFn<typeof features, ProductOfTable>({
		filter: (_dataValue, filterValue, row) => {
			const product = row.original;
			if (!product.crossCode) return false;
			return (
				product.crossCode.toLowerCase().includes(filterValue) ||
				product.manufacturerCode.toLowerCase().includes(filterValue)
			);
		},
		autoRemove: (val) => !String(val ?? '').trim(),
		resolveFilterValue: (val) =>
			String(val ?? '')
				.trim()
				.toLowerCase()
	});
</script>

<script lang="ts">
	import { Funnel } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { createTable, FlexRender, renderSnippet, type Updater } from '@tanstack/svelte-table';

	let { products }: { products: ProductOfTable[] } = $props();

	let searchFilterVal = $state('');
	let filter: string | null = $derived(searchFilterVal.length > 0 ? searchFilterVal.trim() : null);

	let thumbnailsInProxyFallback = new SvelteSet<string>();
	let thumbnailsHidden = new SvelteSet<string>();

	interface HighlightPart {
		text: string;
		isHighlight: boolean;
	}

	function highlight(original: string, filter: string): HighlightPart[] {
		if (!filter) return [{ text: original, isHighlight: false }];

		const parts: HighlightPart[] = [];
		// Escape special regex characters in filter to treat it as literal
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

	function setGlobalFilter(updater: Updater<string>) {
		searchFilterVal = typeof updater === 'function' ? updater(searchFilterVal) : (updater ?? '');
	}

	const columns = columnHelper.columns([
		columnHelper.display({
			id: 'source',
			header: 'Source',
			cell: ({ row }) => renderSnippet(sourceCell, { src: row.original.source.image })
		}),
		columnHelper.accessor('manufacturerCode', {
			header: 'Manufacturer Code',
			cell: (info) => renderSnippet(highlightCell, { value: info.getValue() })
		}),
		columnHelper.accessor('crossCode', {
			header: 'Cross Code',
			enableGlobalFilter: false,
			cell: (info) => renderSnippet(highlightCell, { value: info.getValue() })
		}),
		columnHelper.accessor('manufacturerName', {
			header: 'Manufacturer Name',
			enableGlobalFilter: false,
			cell: (info) => info.getValue()
		}),
		columnHelper.display({
			id: 'thumbnails',
			cell: ({ row }) => renderSnippet(thumbnailsCell, { urls: row.original.thumbnails })
		}),
		columnHelper.display({
			id: 'detailsUrl',
			cell: ({ row }) => renderSnippet(detailsCell, { href: row.original.detailsUrl })
		})
	]);

	const table = createTable({
		features,
		columns,
		get data() {
			return products;
		},
		state: {
			get globalFilter() {
				return filter && filter.length > 0 ? filter : undefined;
			}
		},
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: productCodeGlobalFilter,
		getColumnCanGlobalFilter: (column) => column.id === 'manufacturerCode'
	});

	const headerClass =
		'text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0';
	const cellClass = 'p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0';
</script>

{#snippet sourceCell({ src }: { src?: string })}
	<img class="h-6 pl-4" {src} alt="s_img" />
{/snippet}

{#snippet highlightCell({ value }: { value: string })}
	{#if filter}
		{@render filterHighlight(value, filter)}
	{:else}
		{value}
	{/if}
{/snippet}

{#snippet filterHighlight(str: string, filter: string)}
	{#each highlight(str, filter) as part, i (`${i}-${part.text}-${part.isHighlight}`)}
		{#if part.isHighlight}
			<span class="text-secondary text-shadow-secondary text-shadow-xs">{part.text}</span>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

{#snippet thumbnailsCell({ urls }: { urls?: string[] })}
	{#if urls}
		<ul>
			{#each urls as url, j (j)}
				<li class:hidden={thumbnailsHidden.has(url)}>
					<img
						src={thumbnailsInProxyFallback.has(url) ? `/proxy?url=${encodeURIComponent(url)}` : url}
						loading="lazy"
						alt="p_img"
						height={32}
						width={32}
						class="size-8 object-cover"
						onerror={() => {
							// if url proxy already attempted then hide
							if (thumbnailsInProxyFallback.has(url)) thumbnailsHidden.add(url);
							else thumbnailsInProxyFallback.add(url);
						}}
					/>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet detailsCell({ href }: { href?: string })}
	{#if href}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a {href} target="_blank" rel="noopener noreferrer">🔗</a>
	{/if}
{/snippet}

<div class="flex w-full items-center gap-2 border border-primary/50 px-2 py-1">
	<Funnel size={16} />
	<input class="w-full bg-primary/10" bind:value={searchFilterVal} />
	<samp class="font-bold"
		>{table.getRowModel().rows.length}/{table.getCoreRowModel().rows.length}</samp
	>
</div>

<table class="mb-32 w-full caption-bottom text-sm">
	<thead>
		{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
			<tr
				class="border-accent-foreground/30 data-[state=selected]:bg-muted border-b transition-colors hover:bg-background"
			>
				{#each headerGroup.headers as header (header.id)}
					<th class={headerClass}>
						{#if !header.isPlaceholder}
							<FlexRender {header} />
						{/if}
					</th>
				{/each}
			</tr>
		{/each}
	</thead>
	<tbody>
		{#each table.getRowModel().rows as row (row.id)}
			<tr
				class={[
					row.getDisplayIndex() % 2 === 0 && 'bg-secondary/5',
					'data-[state=selected]:bg-muted'
				]}
			>
				{#each row.getAllCells() as cell (cell.id)}
					<td class={cellClass}>
						<FlexRender {cell} />
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
