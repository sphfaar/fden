<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ArrowUp01 } from 'lucide-svelte';
	import { ArrowDown10 } from 'lucide-svelte';

	// let { value, variant = 'ghost', ...restProps }: ComponentProps<typeof Button> = $props();
	let {
		buttonText,
		isSorted,
		buttonProps
	}: { buttonText: string; isSorted: string; buttonProps: ComponentProps<typeof Button> } =
		$props();
	const { variant = 'ghost', ...restProps } = buttonProps;
</script>

<Button {variant} {...restProps}>
	{buttonText}
	{#if isSorted === 'asc'}
		<ArrowUp01 class="ml-2 size-4" />
	{:else if isSorted === 'desc'}
		<ArrowDown10 class="ml-2 size-4" />
	{/if}
</Button>
