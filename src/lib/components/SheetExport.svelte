<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { writeFile, utils } from 'xlsx';
	import * as Popover from '$lib/components/ui/popover';
	import * as Command from '$lib/components/ui/command';
	import { Button } from '$lib/components/ui/button';
	import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
	import ListChecks from 'lucide-svelte/icons/list-checks';
	import ListX from 'lucide-svelte/icons/list-x';
	import Check from 'lucide-svelte/icons/check';
	import { convertSheetToAoA } from '$lib/convertSheetToAoA';

	let {
		productsOfTable,
		visibleColumns
	}: { productsOfTable: ProductOfTable[]; visibleColumns: string[] } = $props();

	const formats = [
		{
			value: 'xlsx',
			label: 'XLSX',
			description: 'Excel 2007+ XML Format',
			color: 'bg-green-950'
		},
		{
			value: 'xls',
			label: 'XLS',
			description: 'Excel 97-2004 Workbook Format',
			color: 'bg-lime-950'
		},
		{
			value: 'csv',
			label: 'CSV',
			description: 'Comma Separated Values',
			color: 'bg-slate-800'
		},
		{
			value: 'ods',
			label: 'ODS',
			description: 'OpenDocument Spreadsheet',
			color: 'bg-teal-950'
		},
		{
			value: 'txt',
			label: 'TXT',
			description: 'UTF-16 Unicode Text',
			color: 'bg-neutral-800'
		},
		{
			value: 'html',
			label: 'HTML',
			description: 'HTML Document',
			color: 'bg-orange-950'
		}
	];
	let exportOpen: boolean = $state(false);
	let selectedFormats: string[] = $state([]);

	function fillSelectedFormats() {
		selectedFormats = formats.map((format) => format.value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'a' && e.ctrlKey) {
			e.preventDefault();
			fillSelectedFormats();
		} else if (e.key === 'd' && e.ctrlKey) {
			e.preventDefault();
			selectedFormats = [];
		}
	}

	function exportFormats() {
		const aoa = convertSheetToAoA(productsOfTable, visibleColumns);
		const ws = utils.aoa_to_sheet(aoa);
		const wb = utils.book_new();
		utils.book_append_sheet(wb, ws, 'Data');
		selectedFormats.forEach((format) => writeFile(wb, `filters.${format}`));
	}
</script>

<div class="flex gap-2">
	<Popover.Root
		bind:open={exportOpen}
		onOpenChange={(isOpen) => {
			if (isOpen) {
				document.addEventListener('keydown', handleKeydown);
			} else {
				document.removeEventListener('keydown', handleKeydown);
			}
		}}
	>
		<Popover.Trigger>
			<Button
				variant="outline"
				role="combobox"
				aria-expanded={exportOpen}
				class="justify-between"
				onclick={() => document.addEventListener('keydown', handleKeydown)}
			>
				<div class="flex gap-2">
					{#if selectedFormats.length > 0}
						{#each selectedFormats as selectedFormat}
							{@const formatData = formats.find((f) => f.value === selectedFormat)}
							<span
								class="select-none rounded-md px-2.5 py-0.5 text-xs font-semibold {formatData?.color} text-secondary-foreground"
							>
								{formatData?.label}
							</span>
						{/each}
					{:else}
						<span class="text-xs">Formats</span>
					{/if}
				</div>
				<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
		</Popover.Trigger>
		<Popover.Content sideOffset={6} align="start" class="w-fit p-0">
			<Command.Root loop>
				<Command.Group>
					<div class="m-2 flex justify-stretch gap-2 text-xs">
						<Command.Item>
							{#snippet child({ props })}
								<Button
									{...props}
									class="h-8 grow content-center items-center text-xs"
									variant="outline"
									onclick={fillSelectedFormats}
									><ListChecks class="mr-1 h-4 w-4 shrink-0 opacity-50" />All<Command.Shortcut
										>⌘A</Command.Shortcut
									></Button
								>
							{/snippet}
						</Command.Item>
						<Command.Item>
							{#snippet child({ props })}
								<Button
									{...props}
									class="h-8 grow text-xs"
									variant="outline"
									onclick={() => (selectedFormats = [])}
									><ListX class="mr-1 h-4 w-4 shrink-0 opacity-50" />None<Command.Shortcut
										>⌘D</Command.Shortcut
									></Button
								>
							{/snippet}</Command.Item
						>
					</div>
				</Command.Group>
				<Command.Group>
					{#each formats as format}
						<Command.Item
							class="cursor-pointer"
							value={format.value}
							onSelect={() => {
								if (selectedFormats.includes(format.value)) {
									selectedFormats = selectedFormats.filter((value) => value !== format.value);
								} else {
									selectedFormats = [...selectedFormats, format.value];
								}
							}}
						>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									!selectedFormats.includes(format.value) && 'text-transparent'
								)}
							/>
							<abbr class="font-bold">{format.label}</abbr>
							<span class="ml-3 text-sm text-muted-foreground"> {format.description}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
	<Button variant="secondary" onclick={exportFormats}>Export</Button>
</div>
