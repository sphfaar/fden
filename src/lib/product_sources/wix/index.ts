import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.png';

export const descriptors: SourceDescriptors = {
	sourceID: 'wix',
	name: 'WIX',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
