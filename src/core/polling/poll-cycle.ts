import { diffPullRequests, type PullRequestEvent } from '@core/events';
import {
  branchKeyOf,
  describeGithubError,
  endpointsFor,
  fetchRequiredApprovalsMany,
  fetchViewer,
  fetchViewerTeams,
  serializeBranchKey,
  type GithubSession,
  type PullRequest,
} from '@core/github';
import type { TokenVault } from '@core/security';
import {
  cacheKey,
  DEFAULT_POLLING,
  type CachedValue,
  type LocalRepositories,
  type PollError,
  type PollingRecord,
  type SettingsRecord,
  type SourceConfig,
  type SourcePollState,
} from '@core/storage';

import {
  fetchRepositorySource,
  fetchSearchSource,
  type SourceFetchResult,
} from './source-fetchers';

export const POLL_THROTTLE_MILLISECONDS = 20_000;
export const VIEWER_TTL_MILLISECONDS = 6 * 3_600_000;
export const TEAMS_TTL_MILLISECONDS = 24 * 3_600_000;
export const APPROVALS_TTL_MILLISECONDS = 24 * 3_600_000;

export interface PollDependencies {
  repositories: Pick<LocalRepositories, 'settings' | 'polling' | 'cache'>;
  vault: Pick<TokenVault, 'getStatus' | 'hasToken' | 'readToken'>;
  now?: () => Date;
}

export type PollOutcome =
  | { kind: 'not-configured' }
  | { kind: 'locked' }
  | { kind: 'throttled' }
  | { kind: 'rate-limited'; until: string }
  | { kind: 'completed'; events: PullRequestEvent[]; succeeded: number; failed: number };

const isFresh = (
  cached: { fetchedAt: string } | null | undefined,
  ttl: number,
  now: Date,
): boolean =>
  cached !== null && cached !== undefined && now.getTime() - Date.parse(cached.fetchedAt) < ttl;

const toPollError = (error: unknown, now: Date): { pollError: PollError; retryAt: Date | null } => {
  const summary = describeGithubError(error, now);
  return {
    pollError: { kind: summary.kind, message: summary.message, at: now.toISOString() },
    retryAt: summary.retryAt,
  };
};

const fetchSource = (
  session: GithubSession,
  source: SourceConfig,
  previous: readonly PullRequest[] | undefined,
  state: SourcePollState | undefined,
): Promise<SourceFetchResult> =>
  source.kind === 'repository'
    ? fetchRepositorySource(session, { owner: source.owner, name: source.name }, previous, state)
    : fetchSearchSource(session, source.query, previous, state);

const applyRequiredApprovals = async (
  session: GithubSession,
  hostKey: string,
  pullRequests: PullRequest[],
  cache: Record<string, CachedValue<number | null>>,
  now: Date,
): Promise<{ pullRequests: PullRequest[]; cache: Record<string, CachedValue<number | null>> }> => {
  const keyOf = (pullRequest: PullRequest): string =>
    `${hostKey}|${serializeBranchKey(branchKeyOf(pullRequest))}`;
  const open = pullRequests.filter((pullRequest) => pullRequest.state === 'open');
  const missing = open.filter(
    (pullRequest) => !isFresh(cache[keyOf(pullRequest)], APPROVALS_TTL_MILLISECONDS, now),
  );
  const nextCache = { ...cache };
  if (missing.length > 0) {
    const fetched = await fetchRequiredApprovalsMany(session, missing.map(branchKeyOf));
    for (const pullRequest of missing) {
      nextCache[keyOf(pullRequest)] = {
        value: fetched.get(serializeBranchKey(branchKeyOf(pullRequest))) ?? null,
        fetchedAt: now.toISOString(),
      };
    }
  }
  return {
    cache: nextCache,
    pullRequests: pullRequests.map((pullRequest) => ({
      ...pullRequest,
      requiredApprovals: nextCache[keyOf(pullRequest)]?.value ?? pullRequest.requiredApprovals,
    })),
  };
};

const reconcileHost = async (
  repositories: PollDependencies['repositories'],
  settings: SettingsRecord,
  hostKey: string,
): Promise<PollingRecord> => {
  const validKeys = new Set(settings.sources.map((source) => cacheKey(hostKey, source.id)));
  await repositories.cache.update((cache) => ({
    entries: Object.fromEntries(
      Object.entries(cache.entries).filter(([key]) => validKeys.has(key)),
    ),
  }));
  return repositories.polling.update((polling) =>
    polling.hostKey === hostKey
      ? {
          ...polling,
          sources: Object.fromEntries(
            Object.entries(polling.sources).filter(([key]) => validKeys.has(key)),
          ),
        }
      : { ...DEFAULT_POLLING, hostKey },
  );
};

export const runPollCycle = async (
  { repositories, vault, now: clock = () => new Date() }: PollDependencies,
  { force = false }: { force?: boolean } = {},
): Promise<PollOutcome> => {
  const now = clock();
  const settings = await repositories.settings.read();
  if (settings.sources.length === 0 || !(await vault.hasToken())) {
    return { kind: 'not-configured' };
  }
  if ((await vault.getStatus()) !== 'unlocked') {
    return { kind: 'locked' };
  }
  const { hostKey } = endpointsFor(settings.host);
  let polling = await reconcileHost(repositories, settings, hostKey);

  if (polling.rateLimitedUntil !== null && Date.parse(polling.rateLimitedUntil) > now.getTime()) {
    return { kind: 'rate-limited', until: polling.rateLimitedUntil };
  }
  const cache = await repositories.cache.read();
  const everySourceCached = settings.sources.every(
    (source) => cacheKey(hostKey, source.id) in cache.entries,
  );
  if (
    !force &&
    everySourceCached &&
    polling.lastRunAt !== null &&
    now.getTime() - Date.parse(polling.lastRunAt) < POLL_THROTTLE_MILLISECONDS
  ) {
    return { kind: 'throttled' };
  }

  const session: GithubSession = { host: settings.host, getToken: () => vault.readToken() };
  const markFailure = async (pollError: PollError, retryAt: Date | null): Promise<PollOutcome> => {
    await repositories.polling.update((current) => ({
      ...current,
      lastRunAt: now.toISOString(),
      lastError: pollError,
      consecutiveFailures: current.consecutiveFailures + 1,
      rateLimitedUntil: retryAt?.toISOString() ?? current.rateLimitedUntil,
    }));
    return retryAt === null
      ? { kind: 'completed', events: [], succeeded: 0, failed: 1 }
      : { kind: 'rate-limited', until: retryAt.toISOString() };
  };

  try {
    if (!isFresh(polling.viewer, VIEWER_TTL_MILLISECONDS, now)) {
      const viewer = await fetchViewer(session);
      polling = await repositories.polling.update((current) => ({
        ...current,
        viewer: {
          value: { login: viewer.login, avatarUrl: viewer.avatarUrl },
          fetchedAt: now.toISOString(),
        },
      }));
    }
    if (!isFresh(polling.viewerTeams, TEAMS_TTL_MILLISECONDS, now)) {
      const teams = await fetchViewerTeams(session);
      polling = await repositories.polling.update((current) => ({
        ...current,
        viewerTeams: { value: teams, fetchedAt: now.toISOString() },
      }));
    }
  } catch (error) {
    const { pollError, retryAt } = toPollError(error, now);
    return markFailure(pollError, retryAt);
  }

  const viewerLogin = polling.viewer?.value.login ?? '';
  const viewerTeams = polling.viewerTeams?.value ?? null;
  const events: PullRequestEvent[] = [];
  let succeeded = 0;
  let failed = 0;
  let lastError: PollError | null = null;
  let rateLimitedUntil: string | null = null;
  let approvalsCache = polling.requiredApprovals;

  for (const source of settings.sources) {
    const key = cacheKey(hostKey, source.id);
    const previousEntry = cache.entries[key];
    const state = polling.sources[key];
    try {
      const result = await fetchSource(session, source, previousEntry?.pullRequests, state);
      const withApprovals = await applyRequiredApprovals(
        session,
        hostKey,
        result.pullRequests,
        approvalsCache,
        now,
      );
      approvalsCache = withApprovals.cache;
      events.push(
        ...diffPullRequests(previousEntry?.pullRequests, withApprovals.pullRequests, {
          viewerLogin,
          viewerTeams,
        }),
      );
      await repositories.cache.update((current) => ({
        entries: {
          ...current.entries,
          [key]: {
            fetchedAt: now.toISOString(),
            pullRequests: withApprovals.pullRequests,
            truncated: result.truncated,
          },
        },
      }));
      const nextState: SourcePollState = {
        etag: result.etag,
        lastFetchAt: now.toISOString(),
        lastFullFetchAt: result.wasFullRefresh
          ? now.toISOString()
          : (state?.lastFullFetchAt ?? null),
        cyclesSinceFull: result.wasFullRefresh ? 0 : (state?.cyclesSinceFull ?? 0) + 1,
        lastError: null,
      };
      polling = await repositories.polling.update((current) => ({
        ...current,
        sources: { ...current.sources, [key]: nextState },
        requiredApprovals: approvalsCache,
      }));
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const { pollError, retryAt } = toPollError(error, now);
      lastError = pollError;
      polling = await repositories.polling.update((current) => ({
        ...current,
        sources: {
          ...current.sources,
          [key]: {
            etag: state?.etag ?? null,
            lastFetchAt: state?.lastFetchAt ?? null,
            lastFullFetchAt: state?.lastFullFetchAt ?? null,
            cyclesSinceFull: state?.cyclesSinceFull ?? 0,
            lastError: pollError,
          },
        },
      }));
      if (retryAt !== null) {
        rateLimitedUntil = retryAt.toISOString();
        break;
      }
      if (pollError.kind === 'unauthorized') {
        break;
      }
    }
  }

  await repositories.polling.update((current) => ({
    ...current,
    lastRunAt: now.toISOString(),
    lastSuccessAt: succeeded > 0 ? now.toISOString() : current.lastSuccessAt,
    lastError: failed > 0 ? lastError : null,
    consecutiveFailures: succeeded > 0 ? 0 : current.consecutiveFailures + (failed > 0 ? 1 : 0),
    rateLimitedUntil,
  }));

  return rateLimitedUntil !== null && succeeded === 0
    ? { kind: 'rate-limited', until: rateLimitedUntil }
    : { kind: 'completed', events, succeeded, failed };
};

export const createPoller = (
  dependencies: PollDependencies,
): { run: (options?: { force?: boolean }) => Promise<PollOutcome> } => {
  let inFlight: Promise<PollOutcome> | null = null;
  return {
    run: (options) => {
      inFlight ??= runPollCycle(dependencies, options).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
};
