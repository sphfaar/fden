import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hydac',
	name: 'Hydac',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
