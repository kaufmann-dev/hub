import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type DB = ReturnType<typeof create>;

function create() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return drizzle(postgres(env.DATABASE_URL), { schema });
}

let instance: DB | undefined;

function getDb(): DB {
	return (instance ??= create());
}

// Transparent lazy proxy: the client is created on first property access, not at
// import time, so building the app needs no DATABASE_URL. Methods are bound to the
// real instance so drizzle's internal `this` works.
export const db = new Proxy({} as DB, {
	get(_target, prop) {
		const real = getDb();
		const value = Reflect.get(real, prop, real);
		return typeof value === 'function' ? value.bind(real) : value;
	}
});
