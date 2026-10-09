// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// adapter-cloudflare 8 no longer sets event.platform.
		// Use `import { env, waitUntil } from 'cloudflare:workers'`, `request.cf`, and global `caches`.
		interface Locals {
			srcSessions: {
				name: string;
				value: string;
			}[];
		}
	}

	type ProductsFromSourcePromises = Map<SourceDescriptors, Promise<ProductsData>>;

	type ProductsFromSources = WeakMap<
		Promise<ProductsData>,
		{
			sourceDescriptors: SourceDescriptorsLocal;
			productsData: ProductsData;
		}
	>;

	interface EnabledSourceCard {
		sourceDescriptors: SourceDescriptorsLocal;
		isChecked: boolean;
		isDataLoaded: boolean; //is Data already loaded after last query
		isMouseOverScrapingType: boolean;
		lastCodeQuery: string | undefined;
	}

	interface SourceDescriptors {
		readonly sourceID: string;
		readonly name: string;
		readonly logo?: string;
		readonly banner?: string;
		readonly scrapingType: 'JSON API' | 'HTML parser' /* | 'Automated browser'*/;
		readonly isLoggedIn: boolean | undefined; // undefined: not mandatory
	}

	interface SourceDescriptorsLocal extends Omit<SourceDescriptors, 'isLoggedIn'> {
		isLoggedIn: boolean | undefined;
	}

	interface ProductsData {
		meta: MetaData;
		products: Product[];
	}

	interface MetaData {
		status: number;
		currentItemsDisplayed: number;
		totalItems?: number | string; //if string the total item is unknown, eg. "120+ items"
		maxItemsPagination?: number;
		page: number;
		pages?: number;
		performanceTimings?: {
			proxyToSource?: number;
			clientToProxy?: number;
		};
	}

	interface Product {
		manufacturer: string;
		manufacturer_code: string;
		source_reference_code: string;
		dimensions?: {
			externalDiameter?: number;
			internalDiameter?: number;
			height?: number;
		};
		specs?: {
			mediaType?: string;
			efficiency?: string; //filtration grade
			flowDirection?: string;
		};
		packaging?: {
			width: number;
			length: number;
			height: number;
		};
		detailsUrl?: string;
		description?: string;
		longDescription?: string;
		category?: string;
		thumbnails?: string[];
		cachedAt?: string;
	}

	interface ProductOfTable {
		source: {
			name: string;
			image?: string;
		};
		manufacturerCode: string;
		crossCode: string;
		manufacturerName: string;
		thumbnails?: string[];
		detailsUrl?: string;
		cachedAt?: string;
	}
}

export {};
