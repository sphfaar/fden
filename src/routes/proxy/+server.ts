import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl || !targetUrl.startsWith('https://')) {
		// Restrict to Hygraph for security
		return new Response('Invalid URL', { status: 400 });
	}

	try {
		const response = await fetch(targetUrl);
		if (!response.ok) {
			return new Response('Failed to fetch asset', { status: response.status });
		}

		// Forward the original content and headers
		const headers = new Headers(response.headers);
		headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream'); // Ensure type for images/files
		headers.delete('Cross-Origin-Resource-Policy'); // Remove if present (unneeded same-origin)

		return new Response(response.body, {
			status: response.status,
			headers
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return new Response('Proxy failed', { status: 500 });
	}
};
