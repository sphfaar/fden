import { getProducts, getNextProducts, getSession } from './get-data.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'fbn',
	name: 'FBN',
	banner,
	scrapingType: 'HTML parser',
	isLoggedIn: false
};

export const getters = {
	getProducts,
	getNextProducts,
	getSession
};
