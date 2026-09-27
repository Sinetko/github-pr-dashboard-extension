import { repositoryPath, type GithubSession, type RepositorySource } from './session';
import { githubGraphql } from '../client/graphql';
import { fetchAllPages } from '../client/pagination';
import { endpointsFor } from '../domain/host';
import {
  isGraphqlPullRequest,
  NODE_BATCH_SIZE,
  PULL_REQUESTS_BY_ID_QUERY,
  SEARCH_PAGE_SIZE,
  SEARCH_PULL_REQUESTS_QUERY,
  type PullRequestsByIdData,
  type SearchPullRequestsData,
} from '../graphql';
import { toPullRequest } from '../transforms/normalize-pull-request';

import type { RateLimitSnapshot } from '../client/rate-limit';
import type { PullRequest } from '../domain/pull-request.types';
import type { RestPullRequestListItem } from '../rest/rest.types';

export interface OpenPullRequestRef {
  number: number;
  nodeId: string;
  updatedAt: string;
}

export type OpenPullRequestList =
  | { notModified: true; etag: string | null; rateLimit: RateLimitSnapshot | null }
  | {
      notModified: false;
      etag: string | null;
      refs: OpenPullRequestRef[];
      truncated: boolean;
      rateLimit: RateLimitSnapshot | null;
    };

export const listOpenPullRequests = async (
  session: GithubSession,
  repository: RepositorySource,
  etag: string | null,
): Promise<OpenPullRequestList> => {
  const { restBaseUrl } = endpointsFor(session.host);
  const result = await fetchAllPages<RestPullRequestListItem>(
    restBaseUrl,
    await session.getToken(),
    `${repositoryPath(repository)}/pulls?state=open&sort=updated&direction=desc&per_page=100`,
    { etag },
  );
  if (result.notModified) {
    return result;
  }
  return {
    notModified: false,
    etag: result.etag,
    truncated: result.truncated,
    rateLimit: result.rateLimit,
    refs: result.items.map((item) => ({
      number: item.number,
      nodeId: item.node_id,
      updatedAt: item.updated_at,
    })),
  };
};

export interface HydrationResult {
  pullRequests: PullRequest[];
  missingNodeIds: string[];
}

export const fetchPullRequestsByNodeIds = async (
  session: GithubSession,
  nodeIds: readonly string[],
): Promise<HydrationResult> => {
  const { graphqlUrl, hostKey } = endpointsFor(session.host);
  const uniqueIds = [...new Set(nodeIds)];
  if (uniqueIds.length === 0) {
    return { pullRequests: [], missingNodeIds: [] };
  }
  const token = await session.getToken();
  const pullRequests: PullRequest[] = [];
  const found = new Set<string>();
  for (let start = 0; start < uniqueIds.length; start += NODE_BATCH_SIZE) {
    const batch = uniqueIds.slice(start, start + NODE_BATCH_SIZE);
    const { data } = await githubGraphql<PullRequestsByIdData>(
      graphqlUrl,
      token,
      PULL_REQUESTS_BY_ID_QUERY,
      { ids: batch },
    );
    for (const node of data.nodes) {
      if (isGraphqlPullRequest(node)) {
        found.add(node.id);
        pullRequests.push(toPullRequest(node, hostKey));
      }
    }
  }
  return { pullRequests, missingNodeIds: uniqueIds.filter((nodeId) => !found.has(nodeId)) };
};

export const DEFAULT_SEARCH_PAGE_CAP = 8;

export const buildSearchQuery = (userQuery: string, updatedSince: Date | null): string => {
  const parts = [userQuery.trim()];
  if (!/(^|\s)(is|type):(pr|pull-request)(\s|$)/i.test(userQuery)) {
    parts.push('is:pr');
  }
  if (updatedSince !== null) {
    parts.push(`updated:>=${updatedSince.toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  }
  return parts.filter((part) => part !== '').join(' ');
};

export interface SearchResult {
  pullRequests: PullRequest[];
  totalCount: number;
  truncated: boolean;
}

export const searchPullRequests = async (
  session: GithubSession,
  userQuery: string,
  {
    updatedSince = null,
    pageCap = DEFAULT_SEARCH_PAGE_CAP,
  }: { updatedSince?: Date | null; pageCap?: number } = {},
): Promise<SearchResult> => {
  const { graphqlUrl, hostKey } = endpointsFor(session.host);
  const token = await session.getToken();
  const query = buildSearchQuery(userQuery, updatedSince);
  const pullRequests: PullRequest[] = [];
  let cursor: string | null = null;
  let totalCount = 0;
  for (let page = 0; page < pageCap; page += 1) {
    const response: { data: SearchPullRequestsData } = await githubGraphql<SearchPullRequestsData>(
      graphqlUrl,
      token,
      SEARCH_PULL_REQUESTS_QUERY,
      { query, first: SEARCH_PAGE_SIZE, after: cursor },
    );
    const { search } = response.data;
    totalCount = search.issueCount;
    pullRequests.push(
      ...search.nodes.filter(isGraphqlPullRequest).map((node) => toPullRequest(node, hostKey)),
    );
    if (!search.pageInfo.hasNextPage || search.pageInfo.endCursor === null) {
      return { pullRequests, totalCount, truncated: false };
    }
    cursor = search.pageInfo.endCursor;
  }
  return { pullRequests, totalCount, truncated: true };
};
