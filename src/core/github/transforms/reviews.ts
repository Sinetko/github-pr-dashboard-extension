import type { PullRequest, Review, ReviewState } from '../domain/pull-request.types';
import type { GraphqlReview, GraphqlReviewState } from '../graphql/graphql.types';

export const toReviewState = (state: GraphqlReviewState): ReviewState | null => {
  switch (state) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes-requested';
    case 'COMMENTED':
      return 'commented';
    case 'DISMISSED':
      return 'dismissed';
    case 'PENDING':
      return null;
  }
};

export const toReview = (raw: GraphqlReview | null): Review | null => {
  const state = raw === null ? null : toReviewState(raw.state);
  if (raw === null || state === null || raw.author === null || raw.submittedAt === null) {
    return null;
  }
  return {
    login: raw.author.login,
    state,
    submittedAt: raw.submittedAt,
    commitOid: raw.commit?.oid ?? null,
  };
};

export const latestReviewPerReviewer = (reviews: readonly Review[]): Review[] => {
  const chronological = [...reviews].sort(
    (left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt),
  );
  const byReviewer = new Map<string, Review>();
  for (const review of chronological) {
    const key = review.login.toLocaleLowerCase();
    const current = byReviewer.get(key);
    const isCommentAfterVerdict =
      review.state === 'commented' && current !== undefined && current.state !== 'commented';
    if (!isCommentAfterVerdict) {
      byReviewer.set(key, review);
    }
  }
  return [...byReviewer.values()];
};

export const countApprovals = (latestReviews: readonly Review[]): number =>
  latestReviews.filter((review) => review.state === 'approved').length;

export const hasChangesRequested = (latestReviews: readonly Review[]): boolean =>
  latestReviews.some((review) => review.state === 'changes-requested');

export const approvalProgress = (
  pullRequest: Pick<PullRequest, 'latestReviews' | 'requiredApprovals'>,
): { approved: number; required: number | null } => ({
  approved: countApprovals(pullRequest.latestReviews),
  required: pullRequest.requiredApprovals,
});
