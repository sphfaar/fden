<script lang="ts">
	import { enhance } from '$app/forms';
	import { fromAction } from 'svelte/attachments';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	let {
		sourceDescriptors,
		class: className
	}: {
		sourceDescriptors: SourceDescriptorsLocal;
		class?: string;
	} = $props();

	let isLoading = $state(false);
	let isError = $state(false);
	let dialogElement: HTMLDialogElement | undefined;

	const isCookieSession = $derived(sourceDescriptors.sessionInput === 'cookie');

	function showDialog() {
		dialogElement?.showModal();
	}

	function hideDialog() {
		dialogElement?.close();
	}

	function applySessionResult(data: Record<string, unknown>) {
		if (data.sourceID !== sourceDescriptors.sourceID) return;
		if (data.sessionCreatedSuccess === true) {
			sourceDescriptors.isLoggedIn = true;
			hideDialog();
			isError = false;
		} else if (data.sessionTerminatedSuccess === true) {
			sourceDescriptors.isLoggedIn = false;
			hideDialog();
			isError = false;
		} else if (data.authError === true) {
			isError = true;
		}
	}

	const enhanceForm = fromAction((element: HTMLFormElement) =>
		enhance(element, () => {
			isLoading = true;
			return async ({ result, update }) => {
				try {
					await update();
					if (result.type !== 'success' && result.type !== 'failure') return;
					if (!result.data || typeof result.data !== 'object') return;
					applySessionResult(result.data);
				} finally {
					isLoading = false;
				}
			};
		})
	);

	function dialog(node: HTMLDialogElement) {
		dialogElement = node;
		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (target?.contains(node)) hideDialog();
		};
		document.addEventListener('click', handleClick, { capture: true });

		return () => {
			document.removeEventListener('click', handleClick, true);
		};
	}
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && hideDialog()} />

<dialog
	class="m-auto w-fit border border-primary/40 bg-background/80 px-6 pt-6 text-primary backdrop-blur-xl"
	{@attach dialog}
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
			<button class="btn-esc cursor-pointer" onclick={hideDialog} formnovalidate>esc</button>
		</form>
	</div>
	<form
		method="POST"
		action="?/createSrcSession"
		class="flex flex-col items-stretch gap-4 py-4"
		{@attach enhanceForm}
	>
		<input type="checkbox" name="sourceID" checked value={sourceDescriptors.sourceID} hidden />
		{#if isCookieSession}
			<textarea
				name="sessionCookie"
				placeholder="wordpress_logged_in_…=…"
				class="mb-3 w-96 border border-primary/30"
				rows="4"
				required
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"></textarea>
			<p class="text-center text-xs opacity-80">
				Paste the wordpress_logged_in cookie from {sourceDescriptors.name}. DevTools, Application,
				Cookies. Include the cookie name.
			</p>
		{:else}
			<input
				name="username"
				placeholder="username/email"
				class="border border-primary/30"
				required
			/>
			<input
				name="password"
				type="password"
				placeholder="password"
				class="mb-3 border border-primary/30"
				required
			/>
		{/if}
		<button
			class="mt-3 cursor-pointer border border-primary/70 hover:bg-primary/70 hover:text-background active:bg-primary active:text-background disabled:bg-background disabled:opacity-100"
			type="submit"
			aria-label="Submit"
			disabled={isLoading}
			>{#if isLoading}<LoaderCircle class="animate-spin" />{:else}Submit{/if}</button
		>
		{#if isError}
			<output
				class="mt-2 text-center text-red-600"
				name="request_status"
				for={isCookieSession ? 'sessionCookie' : 'username password'}
			>
				Auth Error
			</output>
		{/if}
	</form>

	<p class="mb-4 text-center text-xs opacity-80">session saved locally as cookie</p>
</dialog>

<form action="?/terminateSrcSession" method="POST" {@attach enhanceForm} class="w-fit">
	<input type="checkbox" name="sourceID" checked value={sourceDescriptors.sourceID} hidden />
	<button
		onclick={(event) => {
			if (sourceDescriptors.isLoggedIn !== false) return;
			event.preventDefault();
			showDialog();
		}}
		class={[
			className,
			'inline-flex h-6 cursor-pointer items-center justify-center gap-2 bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'
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
