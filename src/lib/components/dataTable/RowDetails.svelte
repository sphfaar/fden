<script lang="ts">
	import { catalogHttpsUrls } from '#lib/safeCatalogUrl.js';

	let {
		product,
		onOpenThumbnail
	}: {
		product: ProductOfTable;
		onOpenThumbnail: (url: string) => void;
	} = $props();

	interface FactLine {
		label: string;
		value: string;
	}

	function pushMillimeter(lines: FactLine[], label: string, value: number | undefined) {
		if (typeof value !== 'number' || !Number.isFinite(value)) return;
		lines.push({ label, value: `${value}mm` });
	}

	function pushText(lines: FactLine[], label: string, value: string | undefined) {
		const text = value?.trim();
		if (!text) return;
		lines.push({ label, value: text });
	}

	function pushNumber(lines: FactLine[], label: string, value: number | undefined) {
		if (typeof value !== 'number' || !Number.isFinite(value)) return;
		lines.push({ label, value: String(value) });
	}

	const category = $derived(product.category?.trim() || '-');
	const description = $derived(
		product.longDescription?.trim() || product.description?.trim() || ''
	);
	const dimensionLines = $derived.by(() => {
		const lines: FactLine[] = [];
		pushMillimeter(lines, 'externalDiameter', product.dimensions?.externalDiameter);
		pushMillimeter(lines, 'internalDiameter', product.dimensions?.internalDiameter);
		pushMillimeter(lines, 'height', product.dimensions?.height);
		pushText(lines, 'threadSize', product.dimensions?.threadSize);
		pushMillimeter(lines, 'gasketExternalDiameter', product.dimensions?.gasketExternalDiameter);
		pushMillimeter(lines, 'gasketInternalDiameter', product.dimensions?.gasketInternalDiameter);
		return lines;
	});
	const specLines = $derived.by(() => {
		const lines: FactLine[] = [];
		// Product.specs.mediaType is the filter material.
		pushText(lines, 'material', product.specs?.mediaType);
		pushText(lines, 'efficiency', product.specs?.efficiency);
		pushText(lines, 'flowDirection', product.specs?.flowDirection);
		return lines;
	});
	const packagingLines = $derived.by(() => {
		const lines: FactLine[] = [];
		pushNumber(lines, 'width', product.packaging?.width);
		pushNumber(lines, 'length', product.packaging?.length);
		pushNumber(lines, 'height', product.packaging?.height);
		return lines;
	});
	const thumbnails = $derived(catalogHttpsUrls(product.thumbnails));
</script>

{#snippet facts(title: string, lines: FactLine[])}
	<dl class="min-w-48 border border-primary/30 px-3 py-2">
		<dt class="font-medium">{title}</dt>
		{#if lines.length === 0}
			<dd>-</dd>
		{:else}
			{#each lines as line (line.label)}
				<dd>{line.label}: {line.value}</dd>
			{/each}
		{/if}
	</dl>
{/snippet}

<div class="flex flex-col gap-3">
	<div>
		<p>Category: {category}</p>
		{#if description}
			<p class="mt-1 [overflow-wrap:anywhere] whitespace-pre-wrap">{description}</p>
		{/if}
	</div>
	<div class="flex flex-wrap items-start gap-3">
		{@render facts('Dimensions', dimensionLines)}
		{@render facts('Specs', specLines)}
		{@render facts('Packaging', packagingLines)}
	</div>
	{#if thumbnails.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each thumbnails as url, i (`${url}\u001f${i}`)}
				<button
					type="button"
					class="cursor-pointer border border-primary/30 bg-white p-0.5 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
					aria-label="Expand thumbnail"
					onclick={() => onOpenThumbnail(url)}
				>
					<img
						src={url}
						alt=""
						loading="lazy"
						decoding="async"
						width="96"
						height="96"
						class="size-24 object-contain"
					/>
				</button>
			{/each}
		</div>
	{/if}
</div>
