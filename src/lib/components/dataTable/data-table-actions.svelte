<script lang="ts">
	let { detailsUrl }: { detailsUrl: string | undefined } = $props();
</script>

<a href={detailsUrl} class={detailsUrl === undefined ? 'hidden' : ''} target="_blank">🔗</a>
