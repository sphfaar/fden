import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.svg';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hengst',
	name: 'Hengst',
	logo: logo,
	banner: banner,
	scrapingType: 'HTML parser',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
