import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.webp';

export const descriptors: SourceDescriptors = {
	sourceID: 'sf',
	name: 'SF',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
