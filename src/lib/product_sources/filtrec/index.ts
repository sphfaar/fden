import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'filtrec',
	name: 'Filtrec',
	logo: logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
