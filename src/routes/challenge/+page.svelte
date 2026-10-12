<script lang="ts">
	import { tick } from 'svelte';

	let { data, form } = $props();

	let token = $state('');
	let isChecking = $state(false);
	let widgetError = $state('');

	const failureMessage = $derived(
		form && typeof form.message === 'string' ? form.message : undefined
	);

	interface TurnstileApi {
		render: (
			element: HTMLElement,
			options: {
				sitekey: string;
				action: string;
				theme: 'dark';
				appearance: 'always';
				callback: (token: string) => void;
				'error-callback': () => void;
				'expired-callback': () => void;
				'timeout-callback': () => void;
				'response-field': false;
			}
		) => string;
		remove: (widgetId: string) => void;
	}

	function turnstileApi(): TurnstileApi | undefined {
		const candidate = (globalThis as { turnstile?: TurnstileApi }).turnstile;
		return candidate;
	}

	async function submitToken(value: string, element: HTMLElement) {
		if (isChecking) return;
		isChecking = true;
		widgetError = '';
		token = value;
		await tick();
		element.closest('form')?.requestSubmit();
	}

	function reportWidgetFailure(message: string) {
		isChecking = false;
		token = '';
		widgetError = message;
	}

	function mountTurnstile(element: HTMLElement) {
		const siteKey = data.siteKey;
		if (!siteKey) return;

		let isCancelled = false;
		let widgetId = '';

		const renderWidget = () => {
			const api = turnstileApi();
			if (isCancelled || !api || widgetId) return;
			widgetId = api.render(element, {
				sitekey: siteKey,
				action: 'enter',
				theme: 'dark',
				appearance: 'always',
				'response-field': false,
				callback: (value) => {
					void submitToken(value, element);
				},
				'error-callback': () => {
					reportWidgetFailure('The human check could not run. Reload the page.');
				},
				'expired-callback': () => {
					reportWidgetFailure('The check expired. Complete it again.');
				},
				'timeout-callback': () => {
					reportWidgetFailure('The check timed out. Reload the page.');
				}
			});
		};

		const onScriptError = () => {
			if (!isCancelled) reportWidgetFailure('The human check could not be loaded.');
		};

		let scriptElement = document.querySelector<HTMLScriptElement>('script[data-turnstile-api]');
		if (turnstileApi()) {
			renderWidget();
		} else if (scriptElement) {
			scriptElement.addEventListener('load', renderWidget);
		} else {
			scriptElement = document.createElement('script');
			scriptElement.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			scriptElement.async = true;
			scriptElement.dataset.turnstileApi = 'true';
			scriptElement.addEventListener('load', renderWidget);
			scriptElement.addEventListener('error', onScriptError);
			document.head.appendChild(scriptElement);
		}

		return () => {
			isCancelled = true;
			scriptElement?.removeEventListener('load', renderWidget);
			scriptElement?.removeEventListener('error', onScriptError);
			if (widgetId) turnstileApi()?.remove(widgetId);
		};
	}
</script>

<svelte:head>
	<title>Human check</title>
</svelte:head>

<main
	class="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center"
>
	<h1 class="text-2xl font-bold">Confirm you are human</h1>
	<p class="text-primary/80">
		Cloudflare Turnstile checks this browser before the catalog opens. A pass lasts 12 hours.
	</p>

	{#if failureMessage}
		<p class="text-error" role="alert">{failureMessage}</p>
	{/if}
	{#if widgetError}
		<p class="text-error" role="alert">{widgetError}</p>
	{/if}

	{#if data.siteKey}
		<form class="flex flex-col items-center gap-4" method="POST">
			<input type="hidden" name="next" value={data.next} />
			<input type="hidden" name="cf-turnstile-response" value={token} />
			<div {@attach mountTurnstile}></div>
			{#if isChecking}
				<p role="status">Checking…</p>
			{/if}
			<button class="sr-only" type="submit">Continue</button>
			<noscript>
				<p role="alert">Turn on JavaScript to complete the check.</p>
			</noscript>
		</form>
	{:else}
		<p class="text-error" role="alert">
			Turnstile is not configured on this server yet. Add the site key and the secret key, then
			reload.
		</p>
	{/if}
</main>
