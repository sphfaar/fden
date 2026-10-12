import { getProducts, getNextProducts } from './get-data.server';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'fleetguard',
	name: 'fleetguard',
	logo,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
