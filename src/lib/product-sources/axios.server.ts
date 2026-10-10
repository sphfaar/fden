import axios from 'axios';
import type { AxiosInstance, CreateAxiosDefaults } from 'axios';

/** Cloudflare Workers fetch() only allows cache 'no-store' | 'no-cache'. Axios fetch adapter defaults to 'default'. */
const fetchOptions = { cache: 'no-store' } as const;

axios.defaults.fetchOptions = {
	...axios.defaults.fetchOptions,
	...fetchOptions
};

export function createAxios(config?: CreateAxiosDefaults): AxiosInstance {
	return axios.create({
		...config,
		fetchOptions: {
			...fetchOptions,
			...config?.fetchOptions
		}
	});
}

export default axios;
