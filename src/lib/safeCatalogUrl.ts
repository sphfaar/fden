const CONTROL_OR_BACKSLASH = /[\u0000-\u001F\u007F\\]/;

const ALLOWED_HOST_SUFFIXES = [
	'hengst.com',
	'ufihyd.com',
	'sf-filter.com',
	'donaldson.com',
	'hifi-filter.com',
	'mann-filter.com',
	'filtrec.com',
	'wixfilters.com',
	'scene7.com',
	'baldwinfilters.com',
	'parker.com',
	'hydac.com',
	'filtrationgroup.com',
	'argo-hytos.com',
	'voith-webshop-pim-public-prod.s3.eu-central-1.amazonaws.com',
	'fleetguard.com',
	'atmus.widen.net',
	'cf-store.widencdn.net'
] as const;

/** Apex and wildcard host sources for CSP `img-src`, matching {@link catalogHttpsUrl}. */
export const CATALOG_CSP_HOSTS = ALLOWED_HOST_SUFFIXES.flatMap(
	(suffix) => [`https://${suffix}`, `https://*.${suffix}`] as const
);

function allowedHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Absolute https URL on a known catalog host. Relative values resolve against `base`. */
export function catalogHttpsUrl(
	value: string | null | undefined,
	base?: string
): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed || CONTROL_OR_BACKSLASH.test(trimmed)) return undefined;

	let url: URL;
	try {
		url = base ? new URL(trimmed, base) : new URL(trimmed);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'https:' || url.username || url.password) return undefined;
	if (!allowedHost(url.hostname)) return undefined;
	return url.href;
}

export function catalogHttpsUrls(urls: string[] | undefined): string[] {
	if (!urls) return [];
	const safe: string[] = [];
	for (const url of urls) {
		const parsed = catalogHttpsUrl(url);
		if (parsed) safe.push(parsed);
	}
	return safe;
}
