<script lang="ts">
	let { urls }: { urls: Promise<number[][] | null> | number[][] } = $props();
</script>

<div class="flex items-center gap-2">
	{#await urls}
		loading pics
	{:then urlsPromised}
		{#if urlsPromised}
			{#each urlsPromised as url}
				<img
					src={`data:image/jpeg;base64,${btoa(String.fromCharCode(...url))}`}
					alt="product thumbnail"
					loading="lazy"
					class="h-8 w-8"
				/>
			{/each}
		{/if}
	{/await}
</div>
