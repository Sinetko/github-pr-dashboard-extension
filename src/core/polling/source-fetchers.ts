import {
  fetchPullRequestsByNodeIds,
  isMergeabilityPending,
  listOpenPullRequests,
  searchPullRequests,
  type GithubSession,
  type PullRequest,
  type RepositorySource,
} from '@core/github';
import type { SourcePollState } from '@core/storage';

export const FULL_REFRESH_EVERY_CYCLES = 12;
export const SEARCH_DELTA_OVERLAP_MILLISECONDS = 2 * 60_000;

export interface SourceFetchResult {
  pullRequests: PullRequest[];
  truncated: boolean;
  etag: string | null;
  wasFullRefresh: boolean;
}

const isOpen = (pullRequest: PullRequest): boolean => pullRequest.state === 'open';

const isVolatile = (pullRequest: PullRequest): boolean =>
  pullRequest.checks === 'pending' || isMergeabilityPending(pullRequest);

const sameInstant = (left: string, right: string): boolean =>
  Date.parse(left) === Date.parse(right);

const needsFullRefresh = (
  previous: readonly PullRequest[] | undefined,
  state: SourcePollState | undefined,
): boolean =>
  previous === undefined ||
  state === undefined ||
  state.cyclesSinceFull + 1 >= FULL_REFRESH_EVERY_CYCLES;

export const fetchRepositorySource = async (
  session: GithubSession,
  repository: RepositorySource,
  previous: readonly PullRequest[] | undefined,
  state: SourcePollState | undefined,
): Promise<SourceFetchResult> => {
  const isFull = needsFullRefresh(previous, state);
  const previousOpen = (previous ?? []).filter(isOpen);
  const previousByNode = new Map(
    previousOpen.map((pullRequest) => [pullRequest.nodeId, pullRequest]),
  );
  const list = await listOpenPullRequests(
    session,
    repository,
    isFull ? null : (state?.etag ?? null),
  );

  const openRefs = list.notModified
    ? previousOpen.map((pullRequest) => ({
        nodeId: pullRequest.nodeId,
        updatedAt: pullRequest.updatedAt,
      }))
    : list.refs;
  const openNodeIds = new Set(openRefs.map((ref) => ref.nodeId));
  const disappeared = list.notModified
    ? []
    : previousOpen.filter((pullRequest) => !openNodeIds.has(pullRequest.nodeId));

  const toHydrate = new Set<string>();
  for (const ref of openRefs) {
    const known = previousByNode.get(ref.nodeId);
    if (
      isFull ||
      known === undefined ||
      !sameInstant(known.updatedAt, ref.updatedAt) ||
      isVolatile(known)
    ) {
      toHydrate.add(ref.nodeId);
    }
  }
  for (const pullRequest of disappeared) {
    toHydrate.add(pullRequest.nodeId);
  }

  const { pullRequests: hydrated } = await fetchPullRequestsByNodeIds(session, [...toHydrate]);
  const hydratedByNode = new Map(hydrated.map((pullRequest) => [pullRequest.nodeId, pullRequest]));

  const current = openRefs
    .map((ref) => hydratedByNode.get(ref.nodeId) ?? previousByNode.get(ref.nodeId))
    .filter((pullRequest): pullRequest is PullRequest => pullRequest !== undefined);
  const closed = disappeared
    .map((pullRequest) => hydratedByNode.get(pullRequest.nodeId))
    .filter(
      (pullRequest): pullRequest is PullRequest =>
        pullRequest !== undefined && !openNodeIds.has(pullRequest.nodeId),
    );

  return {
    pullRequests: [...current, ...closed],
    truncated: !list.notModified && list.truncated,
    etag: list.etag,
    wasFullRefresh: isFull,
  };
};

export const fetchSearchSource = async (
  session: GithubSession,
  query: string,
  previous: readonly PullRequest[] | undefined,
  state: SourcePollState | undefined,
): Promise<SourceFetchResult> => {
  const lastFetchAt = state?.lastFetchAt ?? null;
  const isFull = needsFullRefresh(previous, state) || lastFetchAt === null;
  const previousOpen = (previous ?? []).filter(isOpen);

  if (isFull) {
    const result = await searchPullRequests(session, query);
    const foundNodes = new Set(result.pullRequests.map((pullRequest) => pullRequest.nodeId));
    const missing = previousOpen.filter((pullRequest) => !foundNodes.has(pullRequest.nodeId));
    const { pullRequests: resolved } = await fetchPullRequestsByNodeIds(
      session,
      missing.map((pullRequest) => pullRequest.nodeId),
    );
    const closed = resolved.filter((pullRequest) => !isOpen(pullRequest));
    return {
      pullRequests: [...result.pullRequests, ...closed],
      truncated: result.truncated,
      etag: null,
      wasFullRefresh: true,
    };
  }

  const since = new Date(Date.parse(lastFetchAt) - SEARCH_DELTA_OVERLAP_MILLISECONDS);
  const delta = await searchPullRequests(session, query, { updatedSince: since });
  const merged = new Map(previousOpen.map((pullRequest) => [pullRequest.nodeId, pullRequest]));
  for (const pullRequest of delta.pullRequests) {
    merged.set(pullRequest.nodeId, pullRequest);
  }
  const deltaNodes = new Set(delta.pullRequests.map((pullRequest) => pullRequest.nodeId));
  const volatile = previousOpen.filter(
    (pullRequest) => isVolatile(pullRequest) && !deltaNodes.has(pullRequest.nodeId),
  );
  const { pullRequests: refreshed } = await fetchPullRequestsByNodeIds(
    session,
    volatile.map((pullRequest) => pullRequest.nodeId),
  );
  for (const pullRequest of refreshed) {
    merged.set(pullRequest.nodeId, pullRequest);
  }
  return {
    pullRequests: [...merged.values()],
    truncated: delta.truncated,
    etag: null,
    wasFullRefresh: false,
  };
};
