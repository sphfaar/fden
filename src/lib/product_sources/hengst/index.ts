import { getProducts, getNextProducts } from './getData.server';
import logo from './logo.svg';
import banner from './banner.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'hengst',
	name: 'Hengst',
	logo: logo,
	banner: banner,
	scrapingType: 'HTML parser',
	isLoggedIn: null
};

export const getters = {
	getProducts,
	getNextProducts
};
