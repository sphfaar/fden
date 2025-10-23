import { getProducts, getNextProducts } from './getData.server';
import banner from './banner.svg';
import logo from './logo.avif';

export const descriptors: SourceDescriptors = {
	sourceID: 'argohytos',
	name: 'Argo Hytos',
	logo: logo,
	banner: banner,
	scrapingType: 'JSON API',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
