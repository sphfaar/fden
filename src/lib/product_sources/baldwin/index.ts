import { getProducts, getNextProducts } from './getData.server';
import logo from './banner.webp';

export const descriptors: SourceDescriptors = {
	sourceID: 'baldwin',
	name: 'Baldwin',
	banner: logo,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
