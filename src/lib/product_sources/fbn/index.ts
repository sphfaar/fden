import { getProducts, getNextProducts, getSession } from './getData.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'fbn',
	name: 'FBN',
	banner: banner,
	scrapingType: 'HTML parser',
	isLoggedIn: false
};

export const getters = {
	getProducts,
	getNextProducts,
	getSession
};
