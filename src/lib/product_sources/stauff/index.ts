import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.avif';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'stauff',
	name: 'STAUFF',
	logo: logo,
	banner: banner,
	scrapingType: 'HTML parser',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
