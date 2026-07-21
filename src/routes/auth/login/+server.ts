import { redirect } from '@sveltejs/kit';
import { beginAuthorization } from '$lib/server/auth/oidc';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, locals }) => {
	if (locals.isAdmin) redirect(303, '/admin');
	const authorizationUrl = await beginAuthorization(cookies);
	redirect(303, authorizationUrl.href);
};
