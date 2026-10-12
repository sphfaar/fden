import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'filtrec',
	name: 'Filtrec',
	logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
