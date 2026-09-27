import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFetchFake, type FetchFake } from '@test/fetch-fake';

import {
  buildSearchQuery,
  fetchPullRequestsByNodeIds,
  fetchRequiredApprovals,
  fetchRequiredApprovalsMany,
  fetchViewer,
  fetchViewerTeams,
  listOpenPullRequests,
  parseRepositorySource,
  searchPullRequests,
  type GithubSession,
} from '.';
import { buildGraphqlPullRequest } from '../__fixtures__/graphql-pull-request.fixture';
import { buildRestPullRequest, linkHeader } from '../__fixtures__/rest.fixture';
import { GithubApiError, GithubUnauthorizedError } from '../client/errors';
import {
  endpointsFor,
  GITHUB_DOT_COM,
  isSameHost,
  parseEnterpriseHost,
  tokenCreationUrl,
  type GithubHost,
} from '../domain/host';

import type { GraphqlNode } from '../graphql/graphql.types';

const TOKEN = 'ghp_test_token_value';
let http: FetchFake;
let getToken: ReturnType<typeof vi.fn<() => Promise<string>>>;
let session: GithubSession;
const REPO = { owner: 'octo-org', name: 'hello-world' };

beforeEach(() => {
  http = installFetchFake();
  getToken = vi.fn(() => Promise.resolve(TOKEN));
  session = { host: GITHUB_DOT_COM, getToken };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hosts', () => {
  it('derives github.com and GHES endpoints', () => {
    expect(endpointsFor(GITHUB_DOT_COM)).toEqual({
      hostKey: 'github.com',
      restBaseUrl: 'https://api.github.com',
      graphqlUrl: 'https://api.github.com/graphql',
      webUrl: 'https://github.com',
    });
    expect(endpointsFor({ kind: 'enterprise', origin: 'https://ghe.example.com:8443' })).toEqual({
      hostKey: 'ghe.example.com:8443',
      restBaseUrl: 'https://ghe.example.com:8443/api/v3',
      graphqlUrl: 'https://ghe.example.com:8443/api/graphql',
      webUrl: 'https://ghe.example.com:8443',
    });
  });

  it.each([
    ['ghe.example.com', 'https://ghe.example.com'],
    ['https://GHE.example.com/api/v3/', 'https://ghe.example.com'],
    ['  https://ghe.example.com:8443 ', 'https://ghe.example.com:8443'],
  ])('parses %j as an enterprise host', (input, origin) => {
    expect(parseEnterpriseHost(input)).toEqual({ kind: 'enterprise', origin });
  });

  it.each([
    '',
    'http://ghe.example.com',
    'github.com',
    'https://api.github.com',
    'https://u:p@ghe.example.com',
    'localhost',
    'https://ghe.example.com/?x=1',
    'https://*.example.com',
    'ftp://x.example.com',
    'https://exa mple.com',
  ])('rejects %j', (input) => {
    expect(parseEnterpriseHost(input)).toBeNull();
  });

  it('compares hosts and builds token URLs', () => {
    const enterprise: GithubHost = { kind: 'enterprise', origin: 'https://ghe.example.com' };
    expect(isSameHost(GITHUB_DOT_COM, { kind: 'github' })).toBe(true);
    expect(isSameHost(GITHUB_DOT_COM, enterprise)).toBe(false);
    expect(tokenCreationUrl(GITHUB_DOT_COM, 'fine-grained')).toBe(
      'https://github.com/settings/personal-access-tokens/new',
    );
    const classic = new URL(tokenCreationUrl(enterprise, 'classic'));
    expect(classic.origin + classic.pathname).toBe('https://ghe.example.com/settings/tokens/new');
    expect(classic.searchParams.get('scopes')).toBe('repo,read:org');
  });
});

describe('parseRepositorySource', () => {
  it('accepts owner/repo and pasted URLs', () => {
    expect(parseRepositorySource('octo-org/hello-world')).toEqual(REPO);
    expect(parseRepositorySource(' https://github.com/octo-org/hello-world.git/ ')).toEqual(REPO);
  });

  it.each(['octo-org', 'a/b/c', 'bad owner/x', 'owner/..', '', 'owner/'])('rejects %j', (input) => {
    expect(parseRepositorySource(input)).toBeNull();
  });
});

describe('fetchViewer / fetchViewerTeams', () => {
  it('returns the viewer and classic scopes', async () => {
    http.get('/user', {
      body: { login: 'mona', name: null, avatar_url: 'https://a/1' },
      headers: { 'x-oauth-scopes': 'repo, read:org' },
    });
    expect(await fetchViewer(session)).toEqual({
      login: 'mona',
      name: null,
      avatarUrl: 'https://a/1',
      scopes: ['repo', 'read:org'],
    });
    expect(getToken).toHaveBeenCalledOnce();
  });

  it('reports null scopes for fine-grained tokens and propagates 401', async () => {
    http.get('/user', { body: { login: 'mona', name: 'Mona', avatar_url: '' } }, { status: 401 });
    expect((await fetchViewer(session)).scopes).toBeNull();
    await expect(fetchViewer(session)).rejects.toBeInstanceOf(GithubUnauthorizedError);
  });

  it('returns teams, or null when the token cannot see them', async () => {
    http.get(
      '/user/teams',
      { body: [{ slug: 'platform', organization: { login: 'octo-org' } }] },
      { status: 403 },
      { status: 500 },
    );
    expect(await fetchViewerTeams(session)).toEqual([
      { organization: 'octo-org', slug: 'platform' },
    ]);
    expect(await fetchViewerTeams(session)).toBeNull();
    await expect(fetchViewerTeams(session)).rejects.toBeInstanceOf(GithubApiError);
  });
});

describe('listOpenPullRequests', () => {
  const path = '/repos/octo-org/hello-world/pulls';

  it('fetches all pages sorted by updated, returning refs + etag', async () => {
    const base =
      'https://api.github.com/repos/octo-org/hello-world/pulls?state=open&sort=updated&direction=desc&per_page=100';
    http.get(
      path,
      {
        body: [buildRestPullRequest(3), buildRestPullRequest(2)],
        headers: { etag: 'W/"one"', link: linkHeader(base, 1, 2) },
      },
      { body: [buildRestPullRequest(1)] },
    );
    const result = await listOpenPullRequests(session, REPO, null);
    expect(result).toMatchObject({ notModified: false, etag: 'W/"one"', truncated: false });
    expect(result.notModified ? [] : result.refs.map((ref) => ref.nodeId)).toEqual([
      'PR_node_3',
      'PR_node_2',
      'PR_node_1',
    ]);
    const firstUrl = http.requests[0]?.url;
    expect(firstUrl?.searchParams.get('sort')).toBe('updated');
    expect(firstUrl?.searchParams.get('state')).toBe('open');
  });

  it('passes the etag and reports 304 as notModified', async () => {
    http.get(path, { status: 304 });
    expect(await listOpenPullRequests(session, REPO, 'W/"one"')).toMatchObject({
      notModified: true,
    });
    expect(http.requests[0]?.headers.get('if-none-match')).toBe('W/"one"');
  });

  it('uses the GHES REST base path', async () => {
    http.get('/api/v3/repos/octo-org/hello-world/pulls', { body: [] });
    await listOpenPullRequests(
      { host: { kind: 'enterprise', origin: 'https://ghe.example.com' }, getToken },
      REPO,
      null,
    );
    expect(http.requests[0]?.url.origin).toBe('https://ghe.example.com');
  });
});

describe('fetchPullRequestsByNodeIds', () => {
  it('batches by 25, skips non-PR/null nodes and reports missing ids', async () => {
    const ids = Array.from({ length: 30 }, (_, index) => `PR_${index}`);
    http.always('POST', '/graphql', (request) => {
      const { variables } = request.body as { variables: { ids: string[] } };
      const nodes: GraphqlNode[] = variables.ids.map((id) =>
        id === 'PR_7'
          ? null
          : id === 'PR_8'
            ? { __typename: 'Issue' }
            : buildGraphqlPullRequest({ id, number: Number(id.slice(3)) }),
      );
      return { body: { data: { nodes }, errors: [{ type: 'NOT_FOUND', message: 'gone' }] } };
    });
    const result = await fetchPullRequestsByNodeIds(session, [...ids, 'PR_0']);
    expect(http.requests).toHaveLength(2);
    expect(result.pullRequests).toHaveLength(28);
    expect(result.missingNodeIds).toEqual(['PR_7', 'PR_8']);
    expect(getToken).toHaveBeenCalledOnce();
  });

  it('makes no request for an empty list', async () => {
    expect(await fetchPullRequestsByNodeIds(session, [])).toEqual({
      pullRequests: [],
      missingNodeIds: [],
    });
    expect(http.requests).toHaveLength(0);
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('search', () => {
  it('builds queries with is:pr and an updated:>= delta', () => {
    expect(buildSearchQuery('review-requested:@me is:open', null)).toBe(
      'review-requested:@me is:open is:pr',
    );
    expect(buildSearchQuery('is:pr author:@me', new Date('2026-01-12T10:00:00.123Z'))).toBe(
      'is:pr author:@me updated:>=2026-01-12T10:00:00Z',
    );
    expect(buildSearchQuery('type:pr', null)).toBe('type:pr');
  });

  it('paginates with cursors and stops at the cap', async () => {
    const page = (cursor: string | null, hasNextPage: boolean, number: number): object => ({
      body: {
        data: {
          search: {
            issueCount: 99,
            pageInfo: { hasNextPage, endCursor: cursor },
            nodes: [buildGraphqlPullRequest({ id: `PR_${number}`, number }), null],
          },
        },
      },
    });
    http.post('/graphql', page('c1', true, 1), page('c2', true, 2), page(null, false, 3));
    const result = await searchPullRequests(session, 'is:open', { updatedSince: null });
    expect(result.pullRequests.map((pullRequest) => pullRequest.number)).toEqual([1, 2, 3]);
    expect(result).toMatchObject({ totalCount: 99, truncated: false });
    expect((http.requests[1]?.body as { variables: { after: string } }).variables.after).toBe('c1');

    http.post('/graphql', page('c1', true, 1), page('c2', true, 2));
    expect(await searchPullRequests(session, 'is:open', { pageCap: 2 })).toMatchObject({
      truncated: true,
    });
  });
});

describe('required approvals', () => {
  const rules = '/repos/octo-org/hello-world/rules/branches/release%2F1.x';
  const protection =
    '/repos/octo-org/hello-world/branches/release%2F1.x/protection/required_pull_request_reviews';
  const key = { ...REPO, branch: 'release/1.x' };
  const byPath = (expected: string) => (url: URL) => url.pathname === expected;

  it('takes the max of ruleset and classic protection counts', async () => {
    http.get(byPath(rules), {
      body: [
        { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
        { type: 'deletion' },
        { type: 'pull_request' },
      ],
    });
    http.get(byPath(protection), { body: { required_approving_review_count: 2 } });
    expect(await fetchRequiredApprovals(session, key)).toBe(2);
  });

  it('degrades to null when neither source is readable, and to the readable one otherwise', async () => {
    http.get(
      byPath(rules),
      { status: 404 },
      { body: [] },
      { body: [{ type: 'pull_request', parameters: { required_approving_review_count: 3 } }] },
    );
    http.get(byPath(protection), { status: 403 }, { body: {} }, { status: 404 });
    expect(await fetchRequiredApprovals(session, key)).toBeNull();
    expect(await fetchRequiredApprovals(session, key)).toBe(0);
    expect(await fetchRequiredApprovals(session, key)).toBe(3);
  });

  it('rethrows unexpected errors', async () => {
    http.get(byPath(rules), { status: 500 }, { body: [] });
    http.get(byPath(protection), { status: 502 });
    await expect(fetchRequiredApprovals(session, key)).rejects.toBeInstanceOf(GithubApiError);
    await expect(fetchRequiredApprovals(session, key)).rejects.toBeInstanceOf(GithubApiError);
  });

  it('resolves many unique branches, isolating failures as null', async () => {
    http.always(
      'GET',
      (url) => url.pathname.includes('/rules/branches/'),
      (request) =>
        request.url.pathname.endsWith('/main')
          ? { body: [{ type: 'pull_request', parameters: { required_approving_review_count: 2 } }] }
          : { status: 500 },
    );
    http.always('GET', (url) => url.pathname.includes('/protection/'), { status: 404 });
    const result = await fetchRequiredApprovalsMany(session, [
      { ...REPO, branch: 'main' },
      { owner: 'Octo-Org', name: 'Hello-World', branch: 'main' },
      { ...REPO, branch: 'dev' },
    ]);
    expect(Object.fromEntries(result)).toEqual({
      'octo-org/hello-world@main': 2,
      'octo-org/hello-world@dev': null,
    });
  });
});
