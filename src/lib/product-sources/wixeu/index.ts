import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'wixeu',
	name: 'WIX EU',
	logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
