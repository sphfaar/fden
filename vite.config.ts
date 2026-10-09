import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { CATALOG_CSP_HOSTS } from './src/lib/safeCatalogUrl.ts';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			inspector: true,
			csp: {
				mode: 'auto',
				directives: {
					'base-uri': ['self'],
					'default-src': ['self'],
					'connect-src': ['self'],
					'font-src': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'frame-src': ['none'],
					'img-src': ['self', 'data:', ...CATALOG_CSP_HOSTS],
					'object-src': ['none'],
					'script-src': ['self'],
					'style-src': ['self'],
					// `style:` bindings and the app.html wrapper cannot take a nonce.
					'style-src-attr': ['unsafe-inline'],
					'worker-src': ['none']
				}
			}
		})
	]
});
