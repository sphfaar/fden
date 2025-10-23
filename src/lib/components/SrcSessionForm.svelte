<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from '../../routes/$types';
	import { CircleX, LoaderCircle } from '@lucide/svelte';

	let {
		sourceDescriptors,
		formActionData
	}: {
		sourceDescriptors: SourceDescriptorsLocal;
		formActionData: ActionData;
	} = $props();
	let isLoading = $state(false);
	let isDialogOpen = $state(false);
	let isError = $state(false);

	function dialogAction(node: HTMLDialogElement) {
		const handleClick = (event: MouseEvent) => {
			const target = event.target as HTMLDialogElement;
			if (target.contains(node)) isDialogOpen = false;
		};
		document.addEventListener('click', handleClick, true);

		$effect(() => {
			if (isDialogOpen) node.showModal();
			else node.close();
		});

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	$effect(() => {
		if (formActionData?.sessionCreatedSuccess) {
			sourceDescriptors.isLoggedIn = true;
			isDialogOpen = false;
			isLoading = false;
			isError = false;
		} else if (formActionData?.sessionTerminatedSuccess) {
			sourceDescriptors.isLoggedIn = false;
			isDialogOpen = false;
			isLoading = false;
			isError = false;
		} else if (formActionData?.authError) {
			isLoading = false;
			isError = true;
		}
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (isDialogOpen = false)} />

<dialog class="bg-background" use:dialogAction>
	<div class="p-4">
		<form method="DIALOG" class="float-end">
			<button onclick={() => (isDialogOpen = false)} formnovalidate><CircleX /></button>
		</form>
		<h4 class="text-xl font-bold">
			<img
				class="inline h-4 align-baseline"
				src={sourceDescriptors.logo ?? sourceDescriptors.banner}
				alt="source logo"
			/>
			{sourceDescriptors.name} Session request
		</h4>
		<p class="my-5">Session saved as cookies on this device</p>
		<form
			method="POST"
			action="?/createSrcSession"
			onsubmit={() => (isLoading = true)}
			class="grid grid-cols-4 grid-rows-3 items-center gap-4 py-4"
			use:enhance
		>
			<input type="checkbox" name="sourceID" checked value={sourceDescriptors.sourceID} hidden />
			<label for="username" class="text-center">username</label>
			<input
				name="username"
				id="username"
				class="col-span-3"
				required
				placeholder="username/email"
			/>
			<label for="password" class="text-center">password</label>
			<input name="password" id="password" type="password" class="col-span-3 mb-3" required />
			<button
				class="col-span-4 disabled:bg-background disabled:opacity-100"
				type="submit"
				disabled={isLoading}
				>{#if isLoading}<LoaderCircle class="animate-spin" />{:else}Submit{/if}</button
			>
			{#if isError}
				<output
					class="col-span-4 mt-2 text-center text-red-600"
					name="request_status"
					for="username password"
				>
					Auth Error
				</output>
			{/if}
		</form>
	</div>
</dialog>

<form action="?/terminateSrcSession" method="POST" use:enhance class="w-fit">
	<input type="checkbox" name="sourceID" checked value={sourceDescriptors.sourceID} hidden />
	<button
		onclick={(e) => {
			if (sourceDescriptors.isLoggedIn === false) {
				e.preventDefault();
				isDialogOpen = true;
			}
		}}
		class="focus-visible:ring-ring inline-flex h-6 cursor-pointer items-center justify-center gap-2 bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
	>
		<img
			src={sourceDescriptors.banner ?? sourceDescriptors.logo}
			alt="Source Logo"
			class="h-4"
		/>{sourceDescriptors.isLoggedIn ? 'logout' : 'login'}
	</button>
</form>

<style lang="postcss">
	::backdrop {
		background-image: repeating-linear-gradient(-45deg, transparent 0 80px, black 80px 160px);
		opacity: 0.3;
	}
</style>
