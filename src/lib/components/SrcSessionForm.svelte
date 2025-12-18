<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from '../../routes/$types';
	import { LoaderCircle } from '@lucide/svelte';

	let {
		sourceDescriptors,
		formActionData,
		class: className
	}: {
		sourceDescriptors: SourceDescriptorsLocal;
		formActionData: ActionData;
		class?: string;
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

<dialog
	class="m-auto w-fit border border-primary/40 bg-background/80 px-6 pt-6 text-primary backdrop-blur-xl"
	use:dialogAction
>
	<div class="mb-4 flex gap-10">
		<h4 class="text-xl font-bold text-nowrap">
			<img
				class="inline h-4 align-baseline"
				src={sourceDescriptors.logo ?? sourceDescriptors.banner}
				alt="source logo"
			/>
			{sourceDescriptors.name} session request
		</h4>
		<form method="DIALOG" class="float-end">
			<button class="btn-esc cursor-pointer" onclick={() => (isDialogOpen = false)} formnovalidate
				>esc</button
			>
		</form>
	</div>
	<form
		method="POST"
		action="?/createSrcSession"
		onsubmit={() => (isLoading = true)}
		class="flex flex-col items-stretch gap-4 py-4"
		use:enhance
	>
		<input type="checkbox" name="sourceID" checked value={sourceDescriptors.sourceID} hidden />
		<input name="username" placeholder="username/email" class="border border-primary/30" required />
		<input
			name="password"
			type="password"
			placeholder="password"
			class="mb-3 border border-primary/30"
			required
		/>
		<button
			class="mt-3 cursor-pointer border border-primary/70 hover:bg-primary/70 hover:text-background active:bg-primary active:text-background disabled:bg-background disabled:opacity-100"
			type="submit"
			disabled={isLoading}
			>{#if isLoading}<LoaderCircle class="animate-spin" />{:else}Submit{/if}</button
		>
		{#if isError}
			<output class="mt-2 text-center text-red-600" name="request_status" for="username password">
				Auth Error
			</output>
		{/if}
	</form>

	<p class="mb-4 text-center text-xs opacity-80">session saved locally as cookie</p>
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
		class={[
			className,
			'inline-flex h-6 cursor-pointer items-center justify-center gap-2 bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
		]}
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
	.btn-esc {
		padding: 2px 4px;
		background-color: var(--color-background);
		border-radius: 3px;
		border: 1px solid var(--color-primary);
		box-shadow: 0 -2px 0 0 var(--color-primary) inset;
		color: var(--color-primary);
		display: inline-block;
		font-size: 0.85em;
		font-weight: bold;
		line-height: 1;
		white-space: nowrap;
		transition-property: transform padding box-shadow;
		transition-duration: 150ms;
		transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
	}
	.btn-esc:active {
		transform: translateY(1px);
		box-shadow: none;
		padding: 1px 4px;
	}
</style>
