import { createHash } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

import { completeAuthorization } from './oidc';

const NOW = new Date('2026-07-20T12:00:00.000Z');
const STATE = 'provider-state';
const ORIGINAL_BROWSER_TOKEN = 'original-browser-flow-token';

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('base64url');
}

function testCookies(flowToken?: string) {
	const get = vi.fn(() => flowToken);
	const remove = vi.fn();
	return {
		cookies: { get, delete: remove } as unknown as Cookies,
		get,
		remove
	};
}

describe('OIDC browser-bound authorization transactions', () => {
	test('rejects a relayed state when the browser has no flow cookie', async () => {
		const { cookies, remove } = testCookies();
		const consume = vi.fn();

		await expect(
			completeAuthorization(
				new URL(`https://hub.example.com/auth/callback?code=relayed&state=${STATE}`),
				cookies,
				NOW,
				consume
			)
		).rejects.toThrow('OIDC authorization transaction is invalid or expired');

		expect(consume).not.toHaveBeenCalled();
		expect(remove).toHaveBeenCalledWith('hub_oidc_flow', { path: '/auth' });
	});

	test('rejects a relayed state when the browser flow cookie does not match', async () => {
		const relayedBrowserToken = 'different-browser-flow-token';
		const { cookies, remove } = testCookies(relayedBrowserToken);
		const consume = vi.fn(async (stateHash: string, browserTokenHash: string) => {
			if (stateHash === sha256(STATE) && browserTokenHash === sha256(ORIGINAL_BROWSER_TOKEN)) {
				return { codeVerifier: 'pkce-verifier', nonce: 'oidc-nonce' };
			}
			return undefined;
		});

		await expect(
			completeAuthorization(
				new URL(`https://hub.example.com/auth/callback?code=relayed&state=${STATE}`),
				cookies,
				NOW,
				consume
			)
		).rejects.toThrow('OIDC authorization transaction is invalid or expired');

		expect(consume).toHaveBeenCalledWith(sha256(STATE), sha256(relayedBrowserToken), NOW);
		expect(remove).toHaveBeenCalledWith('hub_oidc_flow', { path: '/auth' });
	});
});
