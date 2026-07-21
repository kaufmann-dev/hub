import { env } from '$env/dynamic/private';

export interface AuthSettings {
	issuer: URL;
	clientId: string;
	clientSecret: string;
	origin: URL;
	callbackUrl: URL;
	postLogoutUrl: URL;
}

function required(name: string, value: string | undefined): string {
	const normalized = value?.trim();
	if (!normalized) throw new Error(`${name} is not set`);
	return normalized;
}

function absoluteUrl(name: string, value: string): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} must be an absolute URL`);
	}
	if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
		throw new Error(`${name} must use HTTPS outside local development`);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error(`${name} must not contain credentials, a query, or a fragment`);
	}
	return url;
}

export function getAuthSettings(): AuthSettings {
	const issuer = absoluteUrl('OIDC_ISSUER', required('OIDC_ISSUER', env.OIDC_ISSUER));
	const origin = absoluteUrl('ORIGIN', required('ORIGIN', env.ORIGIN));
	if (origin.pathname !== '/') throw new Error('ORIGIN must not contain a path');

	return {
		issuer,
		clientId: required('OIDC_CLIENT_ID', env.OIDC_CLIENT_ID),
		clientSecret: required('OIDC_CLIENT_SECRET', env.OIDC_CLIENT_SECRET),
		origin,
		callbackUrl: new URL('/auth/callback', origin),
		// Post-logout landing preserves the previous behavior: the public homepage.
		postLogoutUrl: origin
	};
}
