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
		}))
	};

	return { db, env, upserts };
});

vi.mock('$env/dynamic/private', () => ({ env: mock.env }));
vi.mock('./db', () => ({ db: mock.db }));

const { githubReposUrl, syncGithubProjects } = await import('./github');

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

	it('fetches authenticated repositories when a token is configured', async () => {
		mock.env.GITHUB_TOKEN = 'secret-token';
		const fetchMock = vi.fn(async () =>
			githubResponse([
				{
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
				}
			])
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(syncGithubProjects()).resolves.toBe(1);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner',
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: 'Bearer secret-token' })
			})
		);
		expect(mock.upserts).toHaveLength(1);
	});
});
