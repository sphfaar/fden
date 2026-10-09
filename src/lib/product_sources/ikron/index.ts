import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'ikron',
	name: 'Ikron',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
