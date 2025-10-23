import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.png';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hifi',
	name: 'HIFI',
	logo: logo,
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
