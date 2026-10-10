import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.png';

export const descriptors: SourceDescriptors = {
	sourceID: 'parker',
	name: 'Parker',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
