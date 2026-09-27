import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildGraphqlPullRequest } from '@core/github/__fixtures__/graphql-pull-request.fixture';
import type { GraphqlPullRequest } from '@core/github/graphql';
import {
  createLocalRepositories,
  DEFAULT_SETTINGS,
  type LocalRepositories,
  type SettingsRecord,
} from '@core/storage';
import { installChromeFake } from '@test/chrome-fake';
import { installFetchFake, type FetchFake, type RecordedRequest } from '@test/fetch-fake';
import { createTokenVaultFake, type TokenVaultFake } from '@test/token-vault-fake';

import { createPoller, FULL_REFRESH_EVERY_CYCLES, runPollCycle, type PollDependencies } from '.';

const STRONG = 'Correct-Horse-Battery-9';
const REPO_A = {
  id: 'repo:octo-org/alpha',
  kind: 'repository' as const,
  owner: 'octo-org',
  name: 'alpha',
};
const REPO_B = {
  id: 'repo:octo-org/beta',
  kind: 'repository' as const,
  owner: 'octo-org',
  name: 'beta',
};
const SEARCH = {
  id: 'search:is:open review-requested:@me',
  kind: 'search' as const,
  label: 'Mine',
  query: 'is:open review-requested:@me',
};

const createGithubServer = (http: FetchFake) => {
  const repos = new Map<string, Map<string, GraphqlPullRequest>>();
  const requests = {
    list: 0,
    notModified: 0,
    graphqlIds: [] as string[][],
    searches: [] as string[],
  };
  let failRepo: { name: string; status: number; headers?: Record<string, string> } | null = null;

  const allPrs = (): GraphqlPullRequest[] =>
    [...repos.values()].flatMap((table) => [...table.values()]);
  const put = (
    repo: string,
    number: number,
    overrides: Partial<GraphqlPullRequest> = {},
  ): GraphqlPullRequest => {
    const table = repos.get(repo) ?? new Map<string, GraphqlPullRequest>();
    repos.set(repo, table);
    const node = buildGraphqlPullRequest({
      id: `PR_${repo}_${number}`,
      number,
      repository: { name: repo, owner: { login: 'octo-org' } },
      url: `https://github.com/octo-org/${repo}/pull/${number}`,
      reviewRequests: { nodes: [] },
      ...table.get(`PR_${repo}_${number}`),
      ...overrides,
    });
    table.set(node.id, node);
    return node;
  };

  http.always('GET', '/user', { body: { login: 'me', name: null, avatar_url: 'https://a/me' } });
  http.always('GET', '/user/teams', { body: [] });
  http.always('GET', (url) => url.pathname.includes('/rules/branches/'), { body: [] });
  http.always('GET', (url) => url.pathname.includes('/protection/'), { status: 404 });
  http.always(
    'GET',
    (url) => /^\/repos\/octo-org\/[^/]+\/pulls$/.test(url.pathname),
    (request: RecordedRequest) => {
      requests.list += 1;
      const repo = request.url.pathname.split('/')[3] ?? '';
      if (failRepo?.name === repo) {
        return {
          status: failRepo.status,
          body: { message: 'boom' },
          headers: failRepo.headers ?? {},
        };
      }
      const open = [...(repos.get(repo)?.values() ?? [])].filter((node) => node.state === 'OPEN');
      const etag = `W/"${open.map((node) => `${node.id}@${node.updatedAt}`).join(',')}"`;
      if (request.headers.get('if-none-match') === etag) {
        requests.notModified += 1;
        return { status: 304, headers: { etag } };
      }
      return {
        body: open.map((node) => ({
          number: node.number,
          node_id: node.id,
          state: 'open',
          title: node.title,
          updated_at: node.updatedAt,
        })),
        headers: { etag },
      };
    },
  );
  http.always('POST', '/graphql', (request: RecordedRequest) => {
    const { query, variables } = request.body as {
      query: string;
      variables: { ids?: string[]; query?: string };
    };
    if (query.includes('nodes(ids')) {
      const ids = variables.ids ?? [];
      requests.graphqlIds.push(ids);
      const byId = new Map(allPrs().map((node) => [node.id, node]));
      return { body: { data: { nodes: ids.map((id) => byId.get(id) ?? null) } } };
    }
    const searchQuery = variables.query ?? '';
    requests.searches.push(searchQuery);
    const since = /updated:>=(\S+)/.exec(searchQuery)?.[1];
    const nodes = allPrs().filter(
      (node) =>
        node.state === 'OPEN' &&
        (since === undefined || Date.parse(node.updatedAt) >= Date.parse(since)),
    );
    return {
      body: {
        data: {
          search: {
            issueCount: nodes.length,
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes,
          },
        },
      },
    };
  });

  return {
    put,
    requests,
    failNext: (name: string, status: number, headers?: Record<string, string>) => {
      failRepo = { name, status, ...(headers === undefined ? {} : { headers }) };
    },
    recover: () => {
      failRepo = null;
    },
  };
};

let repositories: LocalRepositories;
let vaultFake: TokenVaultFake;
let server: ReturnType<typeof createGithubServer>;
let clock: Date;
let deps: PollDependencies;

const configure = async (settings: Partial<SettingsRecord> = {}): Promise<void> => {
  await repositories.settings.write({
    ...DEFAULT_SETTINGS,
    sources: [REPO_A],
    activeSourceId: REPO_A.id,
    ...settings,
  });
};
const advance = (minutes: number): void => {
  clock = new Date(clock.getTime() + minutes * 60_000);
};
const cached = async (sourceId: string) =>
  (await repositories.cache.read()).entries[`github.com|${sourceId}`];

beforeEach(async () => {
  installChromeFake();
  const http = installFetchFake();
  server = createGithubServer(http);
  repositories = createLocalRepositories();
  vaultFake = createTokenVaultFake();
  await vaultFake.vault.setupPassword(STRONG);
  await vaultFake.vault.saveToken('github_pat_test_token_value_123');
  clock = new Date('2026-01-20T12:00:00Z');
  deps = { repositories, vault: vaultFake.vault, now: () => clock };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runPollCycle gating', () => {
  it('does nothing until configured and unlocked', async () => {
    expect(await runPollCycle(deps)).toEqual({ kind: 'not-configured' });
    await configure();
    await vaultFake.vault.lock();
    expect(await runPollCycle(deps)).toEqual({ kind: 'locked' });
  });

  it('throttles back-to-back polls unless forced or a source has no cache yet', async () => {
    await configure();
    server.put('alpha', 1);
    expect((await runPollCycle(deps)).kind).toBe('completed');
    advance(0.1);
    expect(await runPollCycle(deps)).toEqual({ kind: 'throttled' });
    expect((await runPollCycle(deps, { force: true })).kind).toBe('completed');
    await configure({ sources: [REPO_A, REPO_B] });
    expect((await runPollCycle(deps)).kind).toBe('completed');
  });
});

describe('repository sources', () => {
  beforeEach(async () => {
    await configure();
  });

  it('first run: full fetch, viewer + approvals cached, no notification flood', async () => {
    server.put('alpha', 1, {
      reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'me' } }] },
    });
    server.put('alpha', 2);
    const outcome = await runPollCycle(deps);
    expect(outcome).toMatchObject({ kind: 'completed', events: [], succeeded: 1, failed: 0 });
    expect((await cached(REPO_A.id))?.pullRequests.map((pr) => pr.number).sort()).toEqual([1, 2]);
    const polling = await repositories.polling.read();
    expect(polling).toMatchObject({
      hostKey: 'github.com',
      consecutiveFailures: 0,
      lastError: null,
      viewer: { value: { login: 'me' } },
    });
    expect(Object.keys(polling.requiredApprovals)).toEqual(['github.com|octo-org/alpha@main']);
    expect((await cached(REPO_A.id))?.pullRequests[0]?.requiredApprovals).toBeNull();
  });

  it('unchanged list → 304 and zero GraphQL hydration', async () => {
    server.put('alpha', 1);
    await runPollCycle(deps);
    advance(5);
    const graphqlCallsBefore = server.requests.graphqlIds.length;
    await runPollCycle(deps);
    expect(server.requests.notModified).toBe(1);
    expect(server.requests.graphqlIds.length).toBe(graphqlCallsBefore);
  });

  it('hydrates only changed PRs and emits review-requested', async () => {
    server.put('alpha', 1);
    server.put('alpha', 2);
    await runPollCycle(deps);
    advance(5);
    server.put('alpha', 2, {
      updatedAt: '2026-01-20T12:04:00Z',
      reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'me' } }] },
    });
    const outcome = await runPollCycle(deps);
    expect(server.requests.graphqlIds.at(-1)).toEqual(['PR_alpha_2']);
    expect(outcome.kind === 'completed' && outcome.events.map((event) => event.type)).toEqual([
      'review-requested',
    ]);
  });

  it('re-hydrates volatile PRs on 304 (CI finishing does not bump updated_at)', async () => {
    const pending = {
      nodes: [
        {
          commit: {
            committedDate: '2026-01-20T11:00:00Z',
            statusCheckRollup: { state: 'PENDING' as const },
          },
        },
      ],
    };
    server.put('alpha', 1, { author: { login: 'me', avatarUrl: '' }, commits: pending });
    await runPollCycle(deps);
    advance(5);
    server.put('alpha', 1, {
      commits: {
        nodes: [
          {
            commit: {
              committedDate: '2026-01-20T11:00:00Z',
              statusCheckRollup: { state: 'FAILURE' },
            },
          },
        ],
      },
    });
    const outcome = await runPollCycle(deps);
    expect(server.requests.notModified).toBe(1);
    expect(server.requests.graphqlIds.at(-1)).toEqual(['PR_alpha_1']);
    expect(outcome.kind === 'completed' && outcome.events.map((event) => event.type)).toEqual([
      'checks-failed',
    ]);
    expect((await cached(REPO_A.id))?.pullRequests[0]?.checks).toBe('failure');
  });

  it('detects merges of PRs that left the open list, then drops them', async () => {
    server.put('alpha', 1);
    server.put('alpha', 2);
    await runPollCycle(deps);
    advance(5);
    server.put('alpha', 2, { state: 'MERGED', updatedAt: '2026-01-20T12:03:00Z' });
    const outcome = await runPollCycle(deps);
    expect(outcome.kind === 'completed' && outcome.events).toMatchObject([
      { type: 'pr-closed', title: 'Pull request merged' },
    ]);
    expect((await cached(REPO_A.id))?.pullRequests.find((pr) => pr.number === 2)?.state).toBe(
      'merged',
    );
    advance(5);
    await runPollCycle(deps);
    expect((await cached(REPO_A.id))?.pullRequests.map((pr) => pr.number)).toEqual([1]);
  });

  it('does a full refresh every N cycles', async () => {
    server.put('alpha', 1);
    await runPollCycle(deps);
    const hydrationsAfterFirst = server.requests.graphqlIds.length;
    for (let cycle = 1; cycle < FULL_REFRESH_EVERY_CYCLES; cycle += 1) {
      advance(5);
      await runPollCycle(deps);
    }
    expect(server.requests.graphqlIds.length).toBe(hydrationsAfterFirst);
    advance(5);
    await runPollCycle(deps);
    expect(server.requests.graphqlIds.length).toBe(hydrationsAfterFirst + 1);
    expect(server.requests.graphqlIds.at(-1)).toEqual(['PR_alpha_1']);
    expect(
      (await repositories.polling.read()).sources['github.com|repo:octo-org/alpha']
        ?.cyclesSinceFull,
    ).toBe(0);
  });
});

describe('failure isolation and backoff', () => {
  it('isolates a failing source; others still update', async () => {
    await configure({ sources: [REPO_A, REPO_B] });
    server.put('alpha', 1);
    server.put('beta', 1);
    server.failNext('alpha', 500);
    const outcome = await runPollCycle(deps);
    expect(outcome).toMatchObject({ kind: 'completed', succeeded: 1, failed: 1 });
    const polling = await repositories.polling.read();
    expect(polling.sources['github.com|repo:octo-org/alpha']?.lastError).toMatchObject({
      kind: 'api',
      message: 'GitHub returned HTTP 500.',
    });
    expect(polling.consecutiveFailures).toBe(0);
    expect(await cached(REPO_B.id)).toBeDefined();
    expect(await cached(REPO_A.id)).toBeUndefined();
  });

  it('stops on rate limit, records resume time, and skips until then', async () => {
    await configure({ sources: [REPO_A, REPO_B] });
    server.failNext('alpha', 403, {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Math.floor(clock.getTime() / 1000) + 600),
    });
    const outcome = await runPollCycle(deps);
    expect(outcome.kind).toBe('rate-limited');
    expect(server.requests.list).toBe(1);
    expect((await repositories.polling.read()).consecutiveFailures).toBe(1);
    advance(5);
    expect((await runPollCycle(deps)).kind).toBe('rate-limited');
    server.recover();
    advance(6);
    expect((await runPollCycle(deps)).kind).toBe('completed');
  });

  it('counts consecutive failures when the token is rejected', async () => {
    await configure();
    const http = installFetchFake();
    http.always('GET', '/user', { status: 401, body: { message: 'Bad credentials' } });
    await runPollCycle(deps);
    advance(5);
    await runPollCycle(deps);
    advance(5);
    await runPollCycle(deps);
    expect(await repositories.polling.read()).toMatchObject({
      consecutiveFailures: 3,
      lastError: { kind: 'unauthorized' },
    });
  });
});

describe('host changes', () => {
  it('resets polling state and prunes foreign cache entries', async () => {
    await configure();
    await repositories.polling.write({
      ...(await repositories.polling.read()),
      hostKey: 'ghe.example.com',
      consecutiveFailures: 7,
      notified: { old: 't' },
    });
    await repositories.cache.write({
      entries: {
        'ghe.example.com|repo:octo-org/alpha': {
          fetchedAt: 't',
          pullRequests: [],
          truncated: false,
        },
      },
    });
    server.put('alpha', 1);
    await runPollCycle(deps);
    const polling = await repositories.polling.read();
    expect(polling).toMatchObject({ hostKey: 'github.com', consecutiveFailures: 0, notified: {} });
    expect(Object.keys((await repositories.cache.read()).entries)).toEqual([
      'github.com|repo:octo-org/alpha',
    ]);
  });
});

describe('search sources', () => {
  it('runs a full search, then updated:>= deltas with overlap', async () => {
    await configure({ sources: [SEARCH], activeSourceId: SEARCH.id });
    server.put('alpha', 1, { updatedAt: '2026-01-20T11:00:00Z' });
    await runPollCycle(deps);
    expect(server.requests.searches[0]).toBe('is:open review-requested:@me is:pr');
    advance(5);
    server.put('alpha', 2, { updatedAt: '2026-01-20T12:04:00Z' });
    await runPollCycle(deps);
    expect(server.requests.searches[1]).toBe(
      'is:open review-requested:@me is:pr updated:>=2026-01-20T11:58:00Z',
    );
    expect((await cached(SEARCH.id))?.pullRequests.map((pr) => pr.number).sort()).toEqual([1, 2]);
  });
});

describe('createPoller', () => {
  it('collapses concurrent triggers into one cycle', async () => {
    await configure();
    server.put('alpha', 1);
    const poller = createPoller(deps);
    const [first, second] = await Promise.all([poller.run(), poller.run({ force: true })]);
    expect(first).toBe(second);
    expect(server.requests.list).toBe(1);
  });
});
