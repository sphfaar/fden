import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'faifiltri',
	name: 'Faifiltri',
	logo,
	scrapingType: 'HTML parser',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
