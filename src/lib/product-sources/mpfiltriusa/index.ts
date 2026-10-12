import { getProducts, getNextProducts, getSession, sessionCookieMaxAge } from './get-data.server';
import banner from './banner.svg';
import logo from './logo.svg';

export const descriptors: SourceDescriptors = {
	sourceID: 'mpfiltriusa',
	name: 'MP Filtri USA',
	banner: banner,
	logo: logo,
	scrapingType: 'HTML parser',
	isLoggedIn: false,
	sessionInput: 'cookie'
};

export const getters = {
	getProducts,
	getNextProducts,
	getSession,
	sessionCookieMaxAge
};
