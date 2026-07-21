import { describe, expect, test } from 'vitest';
import {
	effectiveExpiresAt,
	isSessionExpired,
	isTrustedActivityRequest,
	newSessionTimes,
	SESSION_ABSOLUTE_MS,
	SESSION_IDLE_MS,
	USER_ACTIVITY_HEADER,
	USER_ACTIVITY_HEADER_VALUE,
	touchedSessionTimes
} from './session-policy';

const START = new Date('2026-07-20T08:00:00.000Z');

describe('OIDC application session policy', () => {
	test('expires after 24 hours without authenticated activity', () => {
		const session = newSessionTimes(START);

		expect(isSessionExpired(session, new Date(START.getTime() + SESSION_IDLE_MS - 1))).toBe(false);
		expect(isSessionExpired(session, new Date(START.getTime() + SESSION_IDLE_MS))).toBe(true);
	});

	test('slides idle expiry without extending the fixed seven-day lifetime', () => {
		const session = newSessionTimes(START);
		const activeAt = new Date(START.getTime() + SESSION_IDLE_MS - 1);
		const touched = touchedSessionTimes(session, activeAt);

		expect(touched).not.toBeNull();
		expect(effectiveExpiresAt(touched!).getTime()).toBe(activeAt.getTime() + SESSION_IDLE_MS);

		const nearAbsoluteExpiry = {
			...session,
			lastActiveAt: new Date(START.getTime() + SESSION_ABSOLUTE_MS - 60_000)
		};
		expect(effectiveExpiresAt(nearAbsoluteExpiry)).toEqual(session.expiresAt);
	});

	test('never revives an idle-expired session', () => {
		const session = newSessionTimes(START);
		const expiredAt = new Date(START.getTime() + SESSION_IDLE_MS);

		expect(touchedSessionTimes(session, expiredAt)).toBeNull();
	});
});

describe('authenticated user activity signal', () => {
	test('accepts only the explicit same-origin activity POST', () => {
		const url = new URL('https://hub.example.com/auth/activity');
		const activity = new Request(url, {
			method: 'POST',
			headers: {
				origin: url.origin,
				'sec-fetch-site': 'same-origin',
				[USER_ACTIVITY_HEADER]: USER_ACTIVITY_HEADER_VALUE
			}
		});

		expect(isTrustedActivityRequest(activity, url, url.origin)).toBe(true);
	});

	test('rejects probes, navigation, mutations, and forged activity requests', () => {
		const origin = 'https://hub.example.com';
		const probe = new Request('https://hub.example.com/', { method: 'HEAD' });
		const polling = new Request('https://hub.example.com/api/weather?city=Vienna');
		const navigation = new Request('https://hub.example.com/admin', {
			headers: {
				accept: 'text/html',
				'sec-fetch-dest': 'document',
				'sec-fetch-mode': 'navigate'
			}
		});
		const backgroundPost = new Request('https://hub.example.com/api/weather', {
			method: 'POST',
			headers: { origin }
		});
		const crossSiteActivity = new Request(`${origin}/auth/activity`, {
			method: 'POST',
			headers: {
				origin: 'https://attacker.example.com',
				'sec-fetch-site': 'cross-site',
				[USER_ACTIVITY_HEADER]: USER_ACTIVITY_HEADER_VALUE
			}
		});

		for (const request of [probe, polling, navigation, backgroundPost, crossSiteActivity]) {
			expect(isTrustedActivityRequest(request, new URL(request.url), origin)).toBe(false);
		}
	});
});
