import { mapWithConcurrency } from '@shared/utils';

import { repositoryPath, type GithubSession } from './session';
import { GithubApiError } from '../client/errors';
import { githubFetch } from '../client/github-fetch';
import { endpointsFor } from '../domain/host';

import type { PullRequest } from '../domain/pull-request.types';
import type { RestBranchRule, RestRequiredPullRequestReviews } from '../rest/rest.types';

export const DETAIL_CONCURRENCY = 6;

export interface BranchKey {
  owner: string;
  name: string;
  branch: string;
}

export const branchKeyOf = (pullRequest: PullRequest): BranchKey => ({
  owner: pullRequest.repository.owner,
  name: pullRequest.repository.name,
  branch: pullRequest.baseRefName,
});

export const serializeBranchKey = ({ owner, name, branch }: BranchKey): string =>
  `${owner.toLowerCase()}/${name.toLowerCase()}@${branch}`;

const isPermissionOrMissing = (error: unknown): boolean =>
  error instanceof GithubApiError && [403, 404].includes(error.status);

export const fetchRequiredApprovals = async (
  session: GithubSession,
  key: BranchKey,
): Promise<number | null> => {
  const { restBaseUrl } = endpointsFor(session.host);
  const token = await session.getToken();
  const base = repositoryPath(key);
  const branch = encodeURIComponent(key.branch);

  let rulesetCount: number | null = null;
  try {
    const rules = await githubFetch<RestBranchRule[]>(
      restBaseUrl,
      token,
      `${base}/rules/branches/${branch}`,
    );
    if (!rules.notModified) {
      const counts = rules.data
        .filter((rule) => rule.type === 'pull_request')
        .map((rule) => rule.parameters?.required_approving_review_count ?? 0);
      rulesetCount = counts.length > 0 ? Math.max(...counts) : null;
    }
  } catch (error) {
    if (!isPermissionOrMissing(error)) {
      throw error;
    }
  }

  let protectionCount: number | null = null;
  try {
    const protection = await githubFetch<RestRequiredPullRequestReviews>(
      restBaseUrl,
      token,
      `${base}/branches/${branch}/protection/required_pull_request_reviews`,
    );
    if (!protection.notModified) {
      protectionCount = protection.data.required_approving_review_count ?? 0;
    }
  } catch (error) {
    if (!isPermissionOrMissing(error)) {
      throw error;
    }
  }

  if (rulesetCount === null && protectionCount === null) {
    return null;
  }
  return Math.max(rulesetCount ?? 0, protectionCount ?? 0);
};

export const fetchRequiredApprovalsMany = async (
  session: GithubSession,
  keys: readonly BranchKey[],
): Promise<Map<string, number | null>> => {
  const unique = [...new Map(keys.map((key) => [serializeBranchKey(key), key])).values()];
  const results = await mapWithConcurrency(unique, DETAIL_CONCURRENCY, (key) =>
    fetchRequiredApprovals(session, key),
  );
  return new Map(
    unique.map((key, index) => {
      const result = results[index];
      return [serializeBranchKey(key), result?.status === 'fulfilled' ? result.value : null];
    }),
  );
};
