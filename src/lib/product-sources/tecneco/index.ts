import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.avif';
import banner from './banner.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'tecneco',
	name: 'Tecneco',
	logo,
	banner,
	scrapingType: 'HTML parser',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
