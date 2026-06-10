import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const SESSION_COOKIE = 'hub_admin';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/** Constant-time string comparison that is safe for differing lengths. */
function safeEqual(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) {
		// Still run a comparison to keep timing roughly constant.
		timingSafeEqual(bufA, bufA);
		return false;
	}
	return timingSafeEqual(bufA, bufB);
}

function requireSecret(): string {
	const secret = env.ADMIN_SESSION_SECRET;
	if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set');
	return secret;
}

function sign(payload: string): string {
	return createHmac('sha256', requireSecret()).update(payload).digest('hex');
}

/** Check a submitted password against ADMIN_PASSWORD. */
export function verifyPassword(input: string): boolean {
	const expected = env.ADMIN_PASSWORD;
	if (!expected) throw new Error('ADMIN_PASSWORD is not set');
	return safeEqual(input, expected);
}

/** Build a signed session cookie value: "<expEpochSeconds>.<hmac>". */
export function createSessionCookieValue(): { value: string; maxAge: number } {
	const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S;
	const value = `${exp}.${sign(String(exp))}`;
	return { value, maxAge: SESSION_MAX_AGE_S };
}

/** Verify a session cookie value: signature valid and not expired. */
export function verifySessionCookieValue(value: string | undefined): boolean {
	if (!value) return false;
	const dot = value.lastIndexOf('.');
	if (dot <= 0) return false;
	const expPart = value.slice(0, dot);
	const sig = value.slice(dot + 1);
	if (!safeEqual(sig, sign(expPart))) return false;
	const exp = Number(expPart);
	if (!Number.isFinite(exp)) return false;
	return exp > Math.floor(Date.now() / 1000);
}
