<script lang="ts">
	let { products, maxRows }: { products: ProductOfTable[]; maxRows: number } = $props();

	// let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: maxRows });
	// let sorting = $state<SortingState>([]);
	// let globalFilter = $state<ColumnFiltersState>([]);
	// let columnVisibility = $state<VisibilityState>({});

	// const table = createSvelteTable({
	// 	get data() {
	// 		return products;
	// 	},
	// 	columns,
	// 	state: {
	// 		get pagination() {
	// 			return pagination;
	// 		},
	// 		get sorting() {
	// 			return sorting;
	// 		},
	// 		get globalFilter() {
	// 			return globalFilter;
	// 		},
	// 		get columnVisibility() {
	// 			return columnVisibility;
	// 		}
	// 	},
	//
	// 	getCoreRowModel: getCoreRowModel(),
	// 	getPaginationRowModel: getPaginationRowModel(),
	// 	getSortedRowModel: getSortedRowModel(),
	// 	getFilteredRowModel: getFilteredRowModel(),
	// 	onPaginationChange: (updater) => {
	// 		if (typeof updater === 'function') {
	// 			pagination = updater(pagination);
	// 		} else {
	// 			pagination = updater;
	// 		}
	// 	},
	// 	onSortingChange: (updater) => {
	// 		if (typeof updater === 'function') {
	// 			sorting = updater(sorting);
	// 		} else {
	// 			sorting = updater;
	// 		}
	// 	},
	// 	onGlobalFilterChange: (updater) => {
	// 		if (typeof updater === 'function') {
	// 			globalFilter = updater(globalFilter);
	// 		} else {
	// 			globalFilter = updater;
	// 		}
	// 	},
	// 	onColumnVisibilityChange: (updater) => {
	// 		if (typeof updater === 'function') {
	// 			columnVisibility = updater(columnVisibility);
	// 		} else {
	// 			columnVisibility = updater;
	// 		}
	// 	}
	// });

	// const visibleColumns = table
	// 	.getFlatHeaders()
	// 	.map((cell) => cell.id)
	// 	.filter((cell) => cell !== 'actions');
</script>

<div class="flex items-stretch gap-4 py-4">
	<input class="max-w-sm" placeholder="Filter filters..." value="" />
	<!-- <Separator orientation="vertical" /> -->
	<!-- <SheetExport productsOfTable={products} {visibleColumns} /> -->
	<!-- <DropdownMenu.Root> -->
	<!-- 	<DropdownMenu.Trigger> -->
	<!-- 		{#snippet child({ props })} -->
	<!-- 			<button {...props} variant="outline" class="ml-auto">Columns</button> -->
	<!-- 		{/snippet} -->
	<!-- 	</DropdownMenu.Trigger> -->
	<!-- 	<DropdownMenu.Content align="end"> -->
	<!-- 		{#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)} -->
	<!-- 			<DropdownMenu.CheckboxItem -->
	<!-- 				class="capitalize" -->
	<!-- 				checked={column.getIsVisible()} -->
	<!-- 				onCheckedChange={(value) => column.toggleVisibility(!!value)} -->
	<!-- 			> -->
	<!-- 				{column.id} -->
	<!-- 			</DropdownMenu.CheckboxItem> -->
	<!-- 		{/each} -->
	<!-- 	</DropdownMenu.Content> -->
	<!-- </DropdownMenu.Root> -->
</div>
<table class="w-full caption-bottom text-sm">
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
	<tbody>
		{#each products as product, i (i)}
			<tr class=" {i % 2 === 0 ? 'bg-secondary/5' : ''} data-[state=selected]:bg-muted">
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					<img class="h-6 pl-4" src={product.source.image} alt={product.source.name} />
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{product.manufacturerCode}
				</td>
				<td class="p-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
					{product.crossCode}
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
