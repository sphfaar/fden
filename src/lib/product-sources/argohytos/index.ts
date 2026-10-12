import { getProducts, getNextProducts } from './get-data.server';
import banner from './banner.svg';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'argohytos',
	name: 'Argo Hytos',
	logo,
	banner,
	scrapingType: 'JSON API',
	isLoggedIn: undefined
};

export const getters = {
	getProducts,
	getNextProducts
};
