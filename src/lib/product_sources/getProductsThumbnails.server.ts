export function getProductThumbnails(urls: string[]): string[] | undefined {
	return urls.map((url) => `/proxy?url=${encodeURIComponent(url)}`);
}
