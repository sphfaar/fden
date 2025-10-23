import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.svg';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'mpfiltriusa',
	name: 'MP Filtri USA',
	banner: banner,
	logo: logo,
	scrapingType: 'HTML parser',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
