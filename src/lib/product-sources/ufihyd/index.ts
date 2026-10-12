import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'ufihyd',
	name: 'UFI Hyd.',
	banner,
	scrapingType: 'HTML parser',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
