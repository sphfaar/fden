import { getProducts, getNextProducts } from './get-data.server';
import logo from './banner.webp';

export const descriptors: SourceDescriptors = {
	sourceID: 'baldwin',
	name: 'Baldwin',
	banner: logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
