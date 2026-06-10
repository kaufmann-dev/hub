import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.isAdmin && url.pathname !== '/admin/login') {
		redirect(303, '/admin/login');
	}
	return { isAdmin: locals.isAdmin };
};
