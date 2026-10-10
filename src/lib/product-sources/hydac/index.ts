import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hydac',
	name: 'Hydac',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
