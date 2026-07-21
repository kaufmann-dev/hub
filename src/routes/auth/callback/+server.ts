import { redirect } from '@sveltejs/kit';
import { completeAuthorization } from '$lib/server/auth/oidc';
import { createSession, destroySession } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, locals, url }) => {
	let idToken: string;
	try {
		idToken = await completeAuthorization(url, cookies);
	} catch {
		redirect(303, '/admin/login?error=oidc');
	}

	if (locals.session) await destroySession(cookies);
	await createSession(cookies, idToken);
	redirect(303, '/admin');
};
