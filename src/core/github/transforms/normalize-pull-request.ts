import { checksStatusFromRollup } from './checks-status';
import { normalizeLabels } from './labels';
import { toMergeability, toMergeState } from './mergeability';
import { countUnresolvedReviewThreads } from './review-threads';
import { latestReviewPerReviewer, toReview } from './reviews';
import { pullRequestId } from '../domain/host';

import type {
  PullRequest,
  PullRequestState,
  Review,
  ReviewRequest,
} from '../domain/pull-request.types';
import type {
  GraphqlPullRequest,
  GraphqlPullRequestState,
  GraphqlRequestedReviewer,
} from '../graphql/graphql.types';

const toState = (state: GraphqlPullRequestState): PullRequestState => {
  switch (state) {
    case 'OPEN':
      return 'open';
    case 'CLOSED':
      return 'closed';
    case 'MERGED':
      return 'merged';
  }
};

const toReviewRequest = (reviewer: GraphqlRequestedReviewer | null): ReviewRequest | null => {
  if (reviewer === null) {
    return null;
  }
  if (reviewer.__typename === 'User' && 'login' in reviewer) {
    return { kind: 'user', login: reviewer.login };
  }
  if (reviewer.__typename === 'Team' && 'slug' in reviewer) {
    return { kind: 'team', organization: reviewer.organization.login, slug: reviewer.slug };
  }
  return null;
};

const latestTimestamp = (timestamps: readonly (string | null | undefined)[]): string => {
  let latest: string | null = null;
  let latestValue = Number.NEGATIVE_INFINITY;
  for (const timestamp of timestamps) {
    const value =
      timestamp === null || timestamp === undefined ? Number.NaN : Date.parse(timestamp);
    if (
      timestamp !== null &&
      timestamp !== undefined &&
      !Number.isNaN(value) &&
      value > latestValue
    ) {
      latest = timestamp;
      latestValue = value;
    }
  }
  return latest ?? '';
};

const isPresent = <TValue>(value: TValue | null): value is TValue => value !== null;

export const toPullRequest = (
  raw: GraphqlPullRequest,
  hostKey: string,
  requiredApprovals: number | null = null,
): PullRequest => {
  const lastCommit = raw.commits.nodes.at(-1)?.commit ?? null;
  const lastComment = raw.comments.nodes.at(-1) ?? null;
  const lastReview = toReview(raw.reviews?.nodes.at(-1) ?? null);
  const opinionatedReviews: Review[] = (raw.latestOpinionatedReviews?.nodes ?? [])
    .map(toReview)
    .filter(isPresent);
  const owner = raw.repository.owner.login;
  const name = raw.repository.name;
  return {
    id: pullRequestId(hostKey, owner, name, raw.number),
    nodeId: raw.id,
    repository: { owner, name },
    number: raw.number,
    title: raw.title,
    htmlUrl: raw.url,
    author:
      raw.author === null ? null : { login: raw.author.login, avatarUrl: raw.author.avatarUrl },
    state: toState(raw.state),
    isDraftNative: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastActivityAt: latestTimestamp([
      raw.createdAt,
      lastCommit?.committedDate,
      lastComment?.createdAt,
      lastReview?.submittedAt,
      ...opinionatedReviews.map((review) => review.submittedAt),
    ]),
    headRefOid: raw.headRefOid,
    baseRefName: raw.baseRefName,
    labels: normalizeLabels(raw.labels?.nodes ?? []),
    requestedReviewers: (raw.reviewRequests?.nodes ?? [])
      .map((node) => toReviewRequest(node?.requestedReviewer ?? null))
      .filter(isPresent),
    latestReviews: latestReviewPerReviewer(opinionatedReviews),
    lastReview,
    lastComment:
      lastComment === null
        ? null
        : { login: lastComment.author?.login ?? null, createdAt: lastComment.createdAt },
    requiredApprovals,
    checks: checksStatusFromRollup(lastCommit?.statusCheckRollup?.state),
    mergeability: toMergeability(raw.mergeable),
    mergeState: toMergeState(raw.mergeStateStatus),
    commentCount: raw.comments.totalCount,
    reviewCount: raw.reviews?.totalCount ?? 0,
    unresolvedThreadCount: countUnresolvedReviewThreads(raw.reviewThreads.nodes),
  };
};
