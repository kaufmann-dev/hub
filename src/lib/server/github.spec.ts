import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
	const env: Record<string, string | undefined> = {};
	const upserts: unknown[] = [];

	const db = {
		insert: vi.fn(() => ({
			values: vi.fn((value: unknown) => ({
				onConflictDoUpdate: vi.fn(async () => {
					upserts.push(value);
				})
			}))
		})),
		delete: vi.fn(() => ({
			where: vi.fn(async () => ({ length: 0 }))
		}))
	};

	return { db, env, upserts };
});

vi.mock('$app/env/private', () => ({
	get GITHUB_USERNAME() {
		return mock.env.GITHUB_USERNAME;
	},
	get GITHUB_TOKEN() {
		return mock.env.GITHUB_TOKEN;
	}
}));
vi.mock('./db', () => ({ db: mock.db }));

const { fetchDependabotAlerts, githubReposUrl, syncGithubProjects } = await import('./github');

const repo = {
	id: 1,
	name: 'private-repo',
	full_name: 'example-user/private-repo',
	html_url: 'https://github.com/example-user/private-repo',
	description: null,
	homepage: null,
	language: 'TypeScript',
	stargazers_count: 0,
	topics: [],
	pushed_at: null,
	fork: false,
	archived: false
};

function githubResponse(repos: unknown[]) {
	return new Response(JSON.stringify(repos), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
}

describe('GitHub project sync', () => {
	beforeEach(() => {
		mock.env.GITHUB_USERNAME = 'example-user';
		mock.env.GITHUB_TOKEN = undefined;
		mock.upserts.length = 0;
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	it('uses the public user repositories endpoint without a token', () => {
		expect(githubReposUrl('example-user', false)).toBe(
			'https://api.github.com/users/example-user/repos?per_page=100&sort=updated&type=owner'
		);
	});

	it('uses the authenticated user repositories endpoint with a token', () => {
		expect(githubReposUrl('example-user', true)).toBe(
			'https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner'
		);
	});

	it('fetches authenticated repositories and their Dependabot alert setting with a token', async () => {
		mock.env.GITHUB_TOKEN = 'secret-token';
		const fetchMock = vi.fn(async (url: string) =>
			url.endsWith('/vulnerability-alerts')
				? new Response(null, { status: 204 })
				: githubResponse([repo])
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(syncGithubProjects()).resolves.toBe(1);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer secret-token' })
			})
		);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/repos/example-user/private-repo/vulnerability-alerts',
			expect.anything()
		);
		expect(mock.upserts).toEqual([expect.objectContaining({ dependabotAlerts: true })]);
	});

	it('syncs archived repositories without checking Dependabot and still skips forks', async () => {
		mock.env.GITHUB_TOKEN = 'secret-token';
		const fetchMock = vi.fn(async () =>
			githubResponse([
				{ ...repo, archived: true },
				{ ...repo, id: 2, name: 'fork', full_name: 'example-user/fork', fork: true }
			])
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(syncGithubProjects()).resolves.toBe(1);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(mock.upserts).toEqual([
			expect.objectContaining({ repoId: 1, archived: true, dependabotAlerts: null })
		]);
	});

	it('skips the Dependabot check without a token', async () => {
		const fetchMock = vi.fn(async () => githubResponse([repo]));
		vi.stubGlobal('fetch', fetchMock);

		await expect(syncGithubProjects()).resolves.toBe(1);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(mock.upserts).toEqual([expect.objectContaining({ dependabotAlerts: null })]);
	});

	it.each([
		[204, true],
		[404, false],
		[403, null]
	])('maps a %i Dependabot response to %s', async (status, expected) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status }))
		);
		await expect(fetchDependabotAlerts('example-user/repo', {})).resolves.toBe(expected);
	});

	it('treats a failed Dependabot request as unknown', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		await expect(fetchDependabotAlerts('example-user/repo', {})).resolves.toBeNull();
	});
});
