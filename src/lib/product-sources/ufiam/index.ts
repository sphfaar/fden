import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'ufiam',
	name: 'UFI AM.',
	banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
