import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.png';

export const descriptors: SourceDescriptors = {
	sourceID: 'parker',
	name: 'Parker',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
