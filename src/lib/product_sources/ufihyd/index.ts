import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'ufihyd',
	name: 'UFI Hyd.',
	banner: banner,
	scrapingType: 'HTML parser',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
