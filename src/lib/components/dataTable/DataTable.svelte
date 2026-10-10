<script module lang="ts">
	import {
		columnFilteringFeature,
		columnOrderingFeature,
		constructFilterFn,
		createColumnHelper,
		createFilteredRowModel,
		createSortedRowModel,
		globalFilteringFeature,
		rowSortingFeature,
		sortFn_text,
		tableFeatures
	} from '@tanstack/svelte-table';

	const features = tableFeatures({
		columnFilteringFeature,
		globalFilteringFeature,
		rowSortingFeature,
		columnOrderingFeature,
		filteredRowModel: createFilteredRowModel(),
		sortedRowModel: createSortedRowModel(),
		sortFns: { text: sortFn_text }
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
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Funnel from '@lucide/svelte/icons/funnel';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import { catalogHttpsUrl, catalogHttpsUrls } from '#lib/safeCatalogUrl.js';
	import RowDetails from './RowDetails.svelte';
	import { onMount, tick } from 'svelte';
	import { createTable, FlexRender, renderSnippet, type Updater } from '@tanstack/svelte-table';
	import {
		COLUMN_ORDER_KEY,
		DEFAULT_COLUMN_ORDER,
		loadColumnOrder,
		saveColumnOrder,
		swapColumnOrder
	} from './columnOrder';
	import {
		exportProductsJson,
		exportProductsSheet,
		LAST_XLS_VERSION,
		LAST_XLSX_VERSION,
		XLS_VERSIONS,
		XLSX_VERSIONS,
		type ExportBookType
	} from './exportTable';

	let { products }: { products: ProductOfTable[] } = $props();

	let searchFilterVal = $state('');
	let filter: string | undefined = $derived(
		searchFilterVal.length > 0 ? searchFilterVal.trim() : undefined
	);
	let columnOrder = $state.raw<string[]>([...DEFAULT_COLUMN_ORDER]);
	let draggingColumnId = $state<string | undefined>(undefined);
	let dropTargetColumnId = $state<string | undefined>(undefined);

	interface HighlightPart {
		text: string;
		isHighlight: boolean;
	}

	function formatCachedAtLocal(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		const pad2 = (part: number) => String(part).padStart(2, '0');
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
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
		searchFilterVal =
			typeof updater === 'function' ? updater(searchFilterVal) : (updater ?? '');
	}

	function setColumnOrder(updater: Updater<string[]>) {
		columnOrder = typeof updater === 'function' ? updater(columnOrder) : updater;
	}

	function columnIdFromEvent(event: DragEvent): string | null {
		const el = event.target instanceof Element ? event.target.closest('[data-column-id]') : null;
		return el?.getAttribute('data-column-id') ?? null;
	}

	function onColumnDragStart(event: DragEvent, columnId: string) {
		draggingColumnId = columnId;
		dropTargetColumnId = undefined;
		event.dataTransfer?.setData('text/plain', columnId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function onTableDragOver(event: DragEvent) {
		if (!draggingColumnId) return;
		const columnId = columnIdFromEvent(event);
		if (!columnId) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		if (dropTargetColumnId !== columnId) dropTargetColumnId = columnId;
	}

	function onTableDrop(event: DragEvent) {
		event.preventDefault();
		const toId = columnIdFromEvent(event);
		const fromId = draggingColumnId ?? event.dataTransfer?.getData('text/plain') ?? '';
		if (fromId && toId) {
			const next = swapColumnOrder(columnOrder, fromId, toId);
			columnOrder = next;
			saveColumnOrder(next);
		}
		draggingColumnId = undefined;
		dropTargetColumnId = undefined;
	}

	function onColumnDragEnd() {
		draggingColumnId = undefined;
		dropTargetColumnId = undefined;
	}

	function onColumnOrderStorage(event: StorageEvent) {
		if (event.key === COLUMN_ORDER_KEY) columnOrder = loadColumnOrder();
	}

	onMount(() => {
		columnOrder = loadColumnOrder();
	});

	const columns = columnHelper.columns([
		columnHelper.accessor((row) => row.source.name, {
			id: 'source',
			header: 'Source',
			enableGlobalFilter: false,
			sortFn: 'text',
			sortDescFirst: false,
			cell: ({ row }) => renderSnippet(sourceCell, { src: row.original.source.image })
		}),
		columnHelper.accessor('manufacturerCode', {
			header: 'Manufacturer Code',
			sortFn: 'text',
			sortDescFirst: false,
			cell: (info) => renderSnippet(highlightCell, { value: info.getValue() })
		}),
		columnHelper.accessor('crossCode', {
			header: 'Cross Code',
			enableGlobalFilter: false,
			sortFn: 'text',
			sortDescFirst: false,
			cell: (info) => renderSnippet(highlightCell, { value: info.getValue() })
		}),
		columnHelper.accessor('manufacturerName', {
			header: 'Manufacturer Name',
			enableGlobalFilter: false,
			sortFn: 'text',
			sortDescFirst: false,
			cell: (info) => info.getValue()
		}),
		columnHelper.display({
			id: 'thumbnails',
			enableSorting: false,
			cell: ({ row }) => renderSnippet(thumbnailsCell, { urls: row.original.thumbnails })
		}),
		columnHelper.display({
			id: 'detailsUrl',
			enableSorting: false,
			cell: ({ row }) => renderSnippet(detailsCell, { href: row.original.detailsUrl })
		}),
		columnHelper.accessor((row) => row.cachedAt ?? '', {
			id: 'cachedAt',
			header: 'Cached',
			enableGlobalFilter: false,
			sortFn: 'text',
			sortDescFirst: true,
			cell: (info) => renderSnippet(cachedAtCell, { value: info.getValue() })
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
			},
			get columnOrder() {
				return columnOrder;
			}
		},
		onGlobalFilterChange: setGlobalFilter,
		onColumnOrderChange: setColumnOrder,
		globalFilterFn: productCodeGlobalFilter,
		getColumnCanGlobalFilter: (column) => column.id === 'manufacturerCode',
		enableMultiSort: false,
		getRowId: (_row, index) => rowKeys[index] ?? String(index)
	});

	const headerClass =
		'h-12 px-4 text-left align-middle font-medium text-primary/50 [&:has([role=checkbox])]:pr-0';
	const cellClass = 'p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0';
	const exportMenuItemClass =
		'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-primary/20';

	let exportMenuOpen = $state(false);
	// One entry per open row. Absent keys stay independent, so opening one row
	// does not refresh the other hundreds.
	let expandedRows = $state<Record<string, true>>({});
	let lightboxUrl = $state<string | undefined>(undefined);
	let lightbox: HTMLDialogElement | undefined;

	const rowKeys = $derived.by(() => {
		const keys: string[] = [];
		const seen: Record<string, number> = {};
		for (const product of products) {
			const base = `${product.source.name}\u001f${product.manufacturerCode}\u001f${product.crossCode}\u001f${product.manufacturerName}`;
			const count = seen[base] ?? 0;
			seen[base] = count + 1;
			keys.push(count === 0 ? base : `${base}\u001f${count}`);
		}
		return keys;
	});

	function visibleProducts(): ProductOfTable[] {
		return table.getRowModel().rows.map((row) => row.original);
	}

	async function exportTable(kind: 'json' | ExportBookType) {
		exportMenuOpen = false;
		const products = visibleProducts();
		if (kind === 'json') {
			exportProductsJson(products);
			return;
		}
		await exportProductsSheet(products, kind);
	}

	function closeExportMenuOnOutside(event: PointerEvent) {
		if (!exportMenuOpen) return;
		if (event.target instanceof Element && event.target.closest('[data-export-menu]')) return;
		exportMenuOpen = false;
	}

	function closeExportMenuOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') exportMenuOpen = false;
	}

	function toggleRow(id: string) {
		if (expandedRows[id]) delete expandedRows[id];
		else expandedRows[id] = true;
	}

	function textCaret(x: number, y: number): { node: Node; offset: number } | undefined {
		const withPosition = document as Document & {
			caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
		};
		const position = withPosition.caretPositionFromPoint?.(x, y);
		if (position) return { node: position.offsetNode, offset: position.offset };
		const range = document.caretRangeFromPoint?.(x, y);
		if (!range) return undefined;
		return { node: range.startContainer, offset: range.startOffset };
	}

	// True only when the pointer is inside a glyph, so padding and empty cells still toggle.
	function clickHitsText(event: MouseEvent): boolean {
		const caret = textCaret(event.clientX, event.clientY);
		if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return false;
		const text = caret.node.textContent ?? '';
		if (text.trim().length === 0) return false;
		const index = Math.min(caret.offset, text.length - 1);
		if (index < 0) return false;
		const probe = document.createRange();
		try {
			probe.setStart(caret.node, index);
			probe.setEnd(caret.node, index + 1);
		} catch {
			return false;
		}
		const rect = probe.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) return false;
		return (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		);
	}

	function onBodyClick(event: MouseEvent) {
		if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
		const selection = document.getSelection();
		if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('a, button, input, textarea, select, label')) return;
		if (clickHitsText(event)) return;
		const id = target.closest('tr[data-row-id]')?.getAttribute('data-row-id');
		if (id) toggleRow(id);
	}

	function rowClicks(node: HTMLTableSectionElement) {
		node.addEventListener('click', onBodyClick);
		return () => node.removeEventListener('click', onBodyClick);
	}

	async function openThumbnail(url: string) {
		lightboxUrl = url;
		await tick();
		if (lightbox && !lightbox.open) lightbox.showModal();
	}

	function onLightboxBackdrop(event: MouseEvent) {
		const dialog = event.currentTarget;
		if (!(dialog instanceof HTMLDialogElement)) return;
		const rect = dialog.getBoundingClientRect();
		const inside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		if (!inside) dialog.close();
	}

	function onLightboxClose() {
		lightboxUrl = undefined;
	}

	function lightboxDialog(node: HTMLDialogElement) {
		lightbox = node;
		node.addEventListener('click', onLightboxBackdrop);
		node.addEventListener('close', onLightboxClose);
		return () => {
			node.removeEventListener('click', onLightboxBackdrop);
			node.removeEventListener('close', onLightboxClose);
			if (lightbox === node) lightbox = undefined;
		};
	}
</script>

<svelte:window
	onpointerdown={closeExportMenuOnOutside}
	onkeydown={closeExportMenuOnEscape}
	onstorage={onColumnOrderStorage}
/>

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
	{const safeUrls = catalogHttpsUrls(urls)}
	{#if safeUrls.length > 0}
		<ul>
			{#each safeUrls as url (url)}
				<li>
					<img
						src={url}
						loading="lazy"
						alt="p_img"
						height={32}
						width={32}
						class="size-8 object-cover"
					/>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet detailsCell({ href }: { href?: string })}
	{const safeHref = catalogHttpsUrl(href)}
	{#if safeHref}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a href={safeHref} target="_blank" rel="noopener noreferrer">🔗</a>
	{/if}
{/snippet}

{#snippet cachedAtCell({ value }: { value: string })}
	{#if value}
		<time class="text-xs whitespace-nowrap tabular-nums" datetime={value}
			>{formatCachedAtLocal(value)}</time
		>
	{/if}
{/snippet}

<div class="flex w-full items-stretch gap-2">
	<div class="flex w-full items-center gap-2 border border-primary/50 px-2 py-1">
		<Funnel size={16} />
		<input type="text" class="min-w-0 flex-1 bg-primary/10" bind:value={searchFilterVal} />
		<samp class="font-bold"
			>{table.getRowModel().rows.length}/{table.getCoreRowModel().rows.length}</samp
		>
	</div>

	<div class="relative flex shrink-0" data-export-menu>
		<button
			type="button"
			class="h-full cursor-pointer border border-primary/50 px-2 text-sm font-medium hover:bg-primary/80 hover:text-background"
			aria-haspopup="menu"
			aria-expanded={exportMenuOpen}
			onclick={() => (exportMenuOpen = !exportMenuOpen)}
		>
			Export
		</button>
		{#if exportMenuOpen}
			<ul
				role="menu"
				class="absolute top-full right-0 z-30 mt-0.5 min-w-36 border border-primary/50 bg-background shadow-lg"
			>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('csv')}>CSV</button
					>
				</li>
				<li role="none" class="group relative">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						aria-haspopup="menu"
						onclick={() => exportTable(LAST_XLSX_VERSION.bookType)}
					>
						XLSX
						<ChevronRight size={14} />
					</button>
					<ul
						role="menu"
						class="absolute top-0 right-full z-40 hidden min-w-56 border border-primary/50 bg-background shadow-lg group-focus-within:block group-hover:block"
					>
						{#each XLSX_VERSIONS as version (version.bookType)}
							<li role="none">
								<button
									type="button"
									role="menuitem"
									class={exportMenuItemClass}
									onclick={() => exportTable(version.bookType)}
									>{version.label}</button
								>
							</li>
						{/each}
					</ul>
				</li>
				<li role="none" class="group relative">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						aria-haspopup="menu"
						onclick={() => exportTable(LAST_XLS_VERSION.bookType)}
					>
						XLS
						<ChevronRight size={14} />
					</button>
					<ul
						role="menu"
						class="absolute top-0 right-full z-40 hidden min-w-56 border border-primary/50 bg-background shadow-lg group-focus-within:block group-hover:block"
					>
						{#each XLS_VERSIONS as version (version.bookType)}
							<li role="none">
								<button
									type="button"
									role="menuitem"
									class={exportMenuItemClass}
									onclick={() => exportTable(version.bookType)}
									>{version.label}</button
								>
							</li>
						{/each}
					</ul>
				</li>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('ods')}>ODS</button
					>
				</li>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('fods')}>FODS</button
					>
				</li>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('html')}>HTML</button
					>
				</li>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('txt')}>TXT</button
					>
				</li>
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class={exportMenuItemClass}
						onclick={() => exportTable('json')}>JSON</button
					>
				</li>
			</ul>
		{/if}
	</div>
</div>

<table
	class="mb-32 w-full caption-bottom text-sm"
	ondragover={onTableDragOver}
	ondrop={onTableDrop}
>
	<thead>
		{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
			<tr
				class="border-b border-primary/30 transition-colors hover:bg-background data-[state=selected]:bg-primary/10"
			>
				{#each headerGroup.headers as header (header.id)}
					<th
						class={[
							headerClass,
							'cursor-grab select-none',
							draggingColumnId === header.column.id && 'opacity-40',
							dropTargetColumnId === header.column.id &&
								draggingColumnId !== header.column.id &&
								'bg-primary/20'
						]}
						data-column-id={header.column.id}
						draggable="true"
						aria-grabbed={draggingColumnId === header.column.id}
						aria-sort={header.column.getIsSorted() === 'asc'
							? 'ascending'
							: header.column.getIsSorted() === 'desc'
								? 'descending'
								: undefined}
						ondragstart={(event) => onColumnDragStart(event, header.column.id)}
						ondragend={onColumnDragEnd}
					>
						{#if !header.isPlaceholder}
							<div class="flex items-center gap-1">
								<span class="inline-flex shrink-0 cursor-grab text-primary/50">
									<GripVertical size={14} aria-hidden="true" />
								</span>
								{#if header.column.getCanSort()}
									<button
										type="button"
										class="inline-flex cursor-pointer items-center gap-1 hover:text-primary"
										onclick={header.column.getToggleSortingHandler()}
									>
										<FlexRender {header} />
										{#if header.column.getIsSorted() === 'asc'}
											<ArrowUp size={14} />
										{:else if header.column.getIsSorted() === 'desc'}
											<ArrowDown size={14} />
										{:else}
											<ArrowUpDown size={14} class="opacity-40" />
										{/if}
									</button>
								{:else}
									<FlexRender {header} />
								{/if}
							</div>
						{/if}
					</th>
				{/each}
			</tr>
		{/each}
	</thead>
	<tbody {@attach rowClicks}>
		{#each table.getRowModel().rows as row (row.id)}
			<tr
				data-row-id={row.id}
				aria-expanded={expandedRows[row.id] ? 'true' : 'false'}
				class={[
					expandedRows[row.id]
						? 'bg-primary/10'
						: row.getDisplayIndex() % 2 === 0 && 'bg-secondary/5',
					!expandedRows[row.id] && 'hover:bg-primary/5',
					'data-[state=selected]:bg-primary/10'
				]}
			>
				{#each row.getAllCells() as cell (cell.id)}
					<td
						class={[
							cellClass,
							draggingColumnId === cell.column.id && 'opacity-40',
							dropTargetColumnId === cell.column.id &&
								draggingColumnId !== cell.column.id &&
								'bg-primary/10'
						]}
						data-column-id={cell.column.id}
					>
						<FlexRender {cell} />
					</td>
				{/each}
			</tr>
			{#if expandedRows[row.id]}
				<tr data-row-id={row.id} class="bg-primary/10">
					<td class="px-4 py-3" colspan={row.getAllCells().length}>
						<RowDetails product={row.original} onOpenThumbnail={openThumbnail} />
					</td>
				</tr>
			{/if}
		{/each}
	</tbody>
</table>

<dialog
	class="m-auto w-fit max-w-[92vw] border border-primary/40 bg-background p-3 text-primary"
	aria-label="Product thumbnail"
	{@attach lightboxDialog}
>
	<div class="mb-2 flex justify-end">
		<button
			type="button"
			class="cursor-pointer border border-primary/50 px-2 py-0.5 text-sm font-medium hover:bg-primary/80 hover:text-background"
			onclick={(event) => event.currentTarget.closest('dialog')?.close()}
		>
			esc
		</button>
	</div>
	{#if lightboxUrl}
		<img
			src={lightboxUrl}
			alt="Product thumbnail"
			class="max-h-[80vh] max-w-[88vw] object-contain"
		/>
	{/if}
</dialog>
