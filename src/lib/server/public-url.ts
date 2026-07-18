import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPrivateIp(address: string): boolean {
	const normalized = address.toLowerCase().replace(/^::ffff:/, '');
	if (isIP(normalized) === 4) {
		const [a, b] = normalized.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	return (
		normalized === '::' ||
		normalized === '::1' ||
		normalized.startsWith('fc') ||
		normalized.startsWith('fd') ||
		normalized.startsWith('fe8') ||
		normalized.startsWith('fe9') ||
		normalized.startsWith('fea') ||
		normalized.startsWith('feb') ||
		normalized.startsWith('ff')
	);
}

export async function assertPublicUrl(url: URL): Promise<void> {
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
	if (url.username || url.password) throw new Error('URLs with credentials are not allowed');
	const hostname = url.hostname.toLowerCase();
	if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
		throw new Error('Local URL blocked');
	}

	const addresses = isIP(hostname)
		? [{ address: hostname }]
		: await lookup(hostname, { all: true });
	if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
		throw new Error('Private or unresolved URL blocked');
	}
}
