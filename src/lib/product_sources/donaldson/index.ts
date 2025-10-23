import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'donaldson',
	name: 'Donaldson',
	logo: logo,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
