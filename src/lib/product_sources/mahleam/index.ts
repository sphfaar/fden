import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'mahleam',
	name: 'MAHLE',
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
