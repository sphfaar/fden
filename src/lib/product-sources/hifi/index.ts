import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.png';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hifi',
	name: 'HIFI',
	logo: logo,
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
