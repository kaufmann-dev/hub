import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	GITHUB_USERNAME: { schema: (input) => input },
	GITHUB_TOKEN: { schema: (input) => input },
	DATABASE_URL: { schema: (input) => input },
	OIDC_ISSUER: { schema: (input) => input },
	ORIGIN: { schema: (input) => input },
	OIDC_CLIENT_ID: { schema: (input) => input },
	OIDC_CLIENT_SECRET: { schema: (input) => input }
});
