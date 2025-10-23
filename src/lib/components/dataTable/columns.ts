import type { ColumnDef } from '@tanstack/table-core';
import DataTableActions from './data-table-actions.svelte';
import DataTableSort from './data-table-sort.svelte';
import DataTableThumbnails from './data-table-thumbnails.svelte';
import { createRawSnippet } from 'svelte';
import { renderSnippet, renderComponent } from '$lib/components/ui/data-table/index.js';

export const columns: ColumnDef<ProductOfTable>[] = [
	// {
	// 	id: 'num',
	// 	header: '#',
	// 	enableSorting: false,
	// 	cell: ({ row }) => row.index + 1
	// },
	{
		accessorKey: 'source',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				buttonText: 'Source',
				isSorted: column.getIsSorted().toString(),
				buttonProps: {
					onclick: column.getToggleSortingHandler()
				}
			}),
		cell: ({ row }) => {
			const nameImageSnippet = createRawSnippet<[{ name: string; image: string }]>(
				(getNameImage) => {
					const { name, image } = getNameImage();
					return {
						render: () => `<img src="${image}" alt="${name}" class="pl-4 h-6"/>`
					};
				}
			);
			return renderSnippet(nameImageSnippet, {
				name: row.original.source.name,
				image: row.original.source.image ?? ''
			});
		}
	},
	{
		accessorKey: 'manufacturerCode',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				buttonText: 'Manufacturer Code',
				isSorted: column.getIsSorted().toString(),
				buttonProps: {
					onclick: column.getToggleSortingHandler()
				}
			})
	},
	{
		accessorKey: 'crossCode',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				buttonText: 'Cross Code',
				isSorted: column.getIsSorted().toString(),
				buttonProps: {
					onclick: column.getToggleSortingHandler()
				}
			}),
		cell: ({ row }) => {
			const crossCodeSnippet = createRawSnippet<[{ code: string }]>((getCrossCode) => {
				const { code } = getCrossCode();
				return {
					render: () => `<span class="text-wrap text-left">${code}</span>`
				};
			});
			return renderSnippet(crossCodeSnippet, { code: row.original.crossCode });
		}
	},
	{
		accessorKey: 'manufacturerName',
		header: ({ column }) =>
			renderComponent(DataTableSort, {
				buttonText: 'Manufacturer Name',
				isSorted: column.getIsSorted().toString(),
				buttonProps: {
					onclick: column.getToggleSortingHandler()
				}
			})
	},
	{
		id: 'thumbnails',
		enableColumnFilter: false,
		cell: ({ row }) => {
			if (row.original.thumbnails)
				return renderComponent(DataTableThumbnails, { urls: row.original.thumbnails });
		}
	},
	{
		id: 'actions',
		enableHiding: false,
		enableColumnFilter: false,
		cell: ({ row }) => {
			return renderComponent(DataTableActions, { detailsUrl: row.original.detailsUrl });
		}
	}
];
