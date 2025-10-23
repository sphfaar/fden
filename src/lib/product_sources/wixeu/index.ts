import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'wixeu',
	name: 'WIX EU',
	logo: logo,
	scrapingType: 'HTML parser',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
