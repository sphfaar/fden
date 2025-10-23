import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'ufiam',
	name: 'UFI AM.',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
