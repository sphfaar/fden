import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.webp';

export const descriptors: SourceDescriptors = {
	sourceID: 'sf',
	name: 'SF',
	banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
