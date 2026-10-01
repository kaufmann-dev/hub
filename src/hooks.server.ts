import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { readSession } from '#lib/server/auth/session.js';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) =>
		resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		)
	);

const handleAuth: Handle = async ({ event, resolve }) => {
	event.locals.session = await readSession(event.cookies);
	event.locals.isAdmin = event.locals.session !== null;
	return resolve(event);
};

export const handle: Handle = sequence(handleAuth, handleParaglide);
