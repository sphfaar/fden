<script lang="ts">
	import { scrapingTypeColors } from '$lib/scarpingTypes';

	let {
		enabledSourceCards = $bindable()
	}: {
		enabledSourceCards: EnabledSourceCard[];
	} = $props();

	let srcConsensusDescription: { short: string; normal: string; long: string } = $state({
		short: '',
		normal: '',
		long: ''
	});

	function getNEnabledSourceCardsByType(
		enabledSourceCards: EnabledSourceCard[],
		scrapingType: SourceDescriptors['scrapingType']
	): { nEnabled: number; maxEnabled: number } {
		let nScEnabled = 0;
		const nMaxScEnabled: number = enabledSourceCards.filter((enabledSC) => {
			if (
				enabledSC.sourceDescriptors.scrapingType === scrapingType &&
				enabledSC.sourceDescriptors.isLoggedIn !== false
			) {
				if (enabledSC.isChecked) nScEnabled++;
				return enabledSourceCards;
			}
		}).length;
		return { nEnabled: nScEnabled, maxEnabled: nMaxScEnabled };
	}

	let enabledSourceCardsAll: { enabled: number; maxEnabled: number } = $derived({
		enabled: enabledSourceCards.filter(
			(sc) => sc.sourceDescriptors.isLoggedIn !== false && sc.isChecked
		).length,
		maxEnabled: enabledSourceCards.filter((sc) => sc.sourceDescriptors.isLoggedIn !== false).length
	});

	let nEnabledSourceCardsByType = $derived(
		new Map<SourceDescriptors['scrapingType'], { nEnabled: number; maxEnabled: number }>([
			['JSON API', getNEnabledSourceCardsByType(enabledSourceCards, 'JSON API')],
			['HTML parser', getNEnabledSourceCardsByType(enabledSourceCards, 'HTML parser')]
			// ['Automated browser', getNEnabledSourceCardsByType(enabledSourceCards, 'Automated browser')]
		])
	);
</script>

{#snippet scrapingTypeButtons(scrapingType: SourceDescriptors['scrapingType'])}
	{@const { nEnabled, maxEnabled } = nEnabledSourceCardsByType.get(scrapingType) ?? {
		nEnabled: NaN,
		maxEnabled: NaN
	}}
	{@const { descriptors, style } = scrapingTypeColors.get(scrapingType) ?? {
		descriptors: null,
		style: null
	}}
	<button
		class="relative min-h-7 w-full max-w-52 min-w-fit cursor-pointer overflow-hidden border font-semibold capitalize shadow-[-5px_0_0_-3px,5px_0_0_-3px] shadow-black {style?.border} {style?.bg} bg-opacity-0 hover:bg-opacity-30 transition-colors hover:text-neutral-50"
		onclick={() => {
			const { nEnabled, maxEnabled } = nEnabledSourceCardsByType.get(scrapingType) ?? {
				nEnabled: NaN,
				maxEnabled: NaN
			};
			enabledSourceCards.forEach((enabledSC) => {
				if (
					enabledSC.sourceDescriptors.scrapingType === scrapingType &&
					enabledSC.sourceDescriptors.isLoggedIn !== false
				) {
					if (nEnabled < maxEnabled) enabledSC.isChecked = true;
					else enabledSC.isChecked = false;
				}
			});
		}}
		onmouseenter={() => {
			srcConsensusDescription = {
				short: descriptors?.shortDescription ?? '',
				normal: descriptors?.description ?? '',
				long: descriptors?.longDescription ?? ''
			};
			enabledSourceCards?.forEach((sc) =>
				sc.sourceDescriptors.scrapingType === scrapingType &&
				sc.sourceDescriptors.isLoggedIn !== false
					? (sc.isMouseOverScrapingType = true)
					: (sc.isMouseOverScrapingType = false)
			);
		}}
		onmouseleave={() => {
			srcConsensusDescription = {
				short: '',
				normal: '',
				long: ''
			};
			enabledSourceCards.forEach((sc) => (sc.isMouseOverScrapingType = false));
		}}
	>
		<svg
			class="absolute top-1/2 -right-1 -left-1 -translate-y-1/2 rotate-90 transform bg-black"
			viewBox="0 0 512 512"
		>
			<circle
				class="fill-transparent {style?.stroke} transition-[stroke-dashoffset]"
				stroke-width="470"
				r="236"
				cx="50%"
				cy="50%"
				style="stroke-dasharray: 1482.83px, 1482.83px; stroke-dashoffset: 
{1482.83 - 1482.83 * (nEnabled / maxEnabled)}px;"
			></circle></svg
		>
		<span
			class="hover:bg-opacity-80 relative m-auto flex size-[calc(100%-0.3rem)] items-center justify-center gap-2 bg-black px-2 text-nowrap transition-colors {style?.textColor} hover:text-white"
			>{descriptors?.consensus}<span>{nEnabled}/{maxEnabled}</span></span
		></button
	>
{/snippet}

<small class="absolute -top-6 left-1/2 -translate-x-1/2 bg-primary/75 px-8 text-black"
	>{srcConsensusDescription.short}</small
>
<small class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-lime-300/80"
	>{srcConsensusDescription.long}</small
>
<span
	class="pointer-events-none my-1.5 box-content w-full min-w-4 bg-primary/20 pt-1.5 pr-4 text-right text-xs text-nowrap text-primary"
	>data format</span
>
<div
	class="relative flex h-10 w-full justify-center gap-2.5 px-2.5 max-[800px]:h-fit max-[800px]:flex-col max-[800px]:items-center"
>
	<div
		class="radbg absolute top-[0.29rem] -z-50 h-[calc(100%-0.5rem)] w-[calc(100%-0.25rem)] bg-linear-to-b from-primary/20 to-lime-500/30"
	></div>
	<button
		class="-2px_0_0_0,2px_0_0_0] min-h-7 w-2/5 max-w-16 min-w-fit border border-destructive bg-black px-1 text-destructive shadow-[-5px_0_0_-3px,5px_0_0_-3px] shadow-black transition-colors hover:text-neutral-50"
		onclick={() => {
			enabledSourceCards.forEach((sc) => (sc.isChecked = false));
		}}>Reset</button
	>
	<button
		class="relative min-h-7 w-3/5 max-w-32 min-w-fit overflow-hidden border border-white text-neutral-300 shadow-[-5px_0_0_-3px,5px_0_0_-3px] shadow-black transition-colors hover:text-neutral-50"
		onclick={() => {
			enabledSourceCards.forEach((sc) =>
				sc.sourceDescriptors.isLoggedIn !== false ? (sc.isChecked = true) : (sc.isChecked = false)
			);
		}}
		onmouseenter={() =>
			enabledSourceCards?.forEach((sc) =>
				sc.sourceDescriptors.isLoggedIn !== false
					? (sc.isMouseOverScrapingType = true)
					: (sc.isMouseOverScrapingType = false)
			)}
		onmouseleave={() => enabledSourceCards.forEach((sc) => (sc.isMouseOverScrapingType = false))}
	>
		<svg
			class="absolute top-1/2 -right-1 -left-1 -translate-y-1/2 rotate-90 transform bg-black"
			viewBox="0 0 512 512"
		>
			<circle
				class="fill-transparent stroke-white transition-[stroke-dashoffset]"
				stroke-width="470"
				r="236"
				cx="50%"
				cy="50%"
				style="stroke-dasharray: 1482.83px, 1482.83px; stroke-dashoffset: 
{1482.83 - 1482.83 * (enabledSourceCardsAll.enabled / enabledSourceCardsAll.maxEnabled)}px;"
			></circle></svg
		>

		<span
			class="hover:bg-opacity-80 relative m-auto flex size-[calc(100%-0.3rem)] flex-initial items-center justify-center gap-2 bg-black px-2"
			>All<span>{enabledSourceCardsAll.enabled}/{enabledSourceCardsAll.maxEnabled}</span></span
		></button
	>

	{@render scrapingTypeButtons('JSON API')}
	{@render scrapingTypeButtons('HTML parser')}
	<!-- {@render scrapingTypeButtons('Automated browser')} -->
</div>
<span
	class="pointer-events-none my-1.5 w-full min-w-4 bg-primary/20 pt-1.5 pl-4 text-xs font-bold text-nowrap text-transparent xl:text-primary"
	>{srcConsensusDescription.normal}</span
>

<style>
	.radbg {
		mask-image: repeating-linear-gradient(0deg, transparent 0 3px, black 3px 6px);
	}
</style>
