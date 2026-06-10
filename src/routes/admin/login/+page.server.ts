import { fail, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { dev } from '$app/environment';
import { loginSchema } from '$lib/schemas';
import { SESSION_COOKIE, createSessionCookieValue, verifyPassword } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.isAdmin) redirect(303, '/admin');
	return { form: await superValidate(zod4(loginSchema)) };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await superValidate(request, zod4(loginSchema));
		if (!form.valid) return fail(400, { form });

		if (!verifyPassword(form.data.password)) {
			return message(form, 'Incorrect password', { status: 401 });
		}

		const { value, maxAge } = createSessionCookieValue();
		cookies.set(SESSION_COOKIE, value, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge
		});
		redirect(303, '/admin');
	}
};
