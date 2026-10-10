import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'wixeu',
	name: 'WIX EU',
	logo: logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
