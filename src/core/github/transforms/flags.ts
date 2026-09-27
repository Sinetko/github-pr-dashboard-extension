import { isDraft } from './is-draft';
import { hasMergeConflicts } from './mergeability';
import { approvalProgress, hasChangesRequested } from './reviews';

import type {
  FlagContext,
  PullRequest,
  PullRequestFlags,
  ReviewRequest,
  TeamRef,
} from '../domain/pull-request.types';

const DAY_MILLISECONDS = 86_400_000;

const sameLogin = (left: string, right: string): boolean =>
  left.toLocaleLowerCase() === right.toLocaleLowerCase();

const isOpenNonDraft = (pullRequest: PullRequest): boolean =>
  pullRequest.state === 'open' && !isDraft(pullRequest);

export const isAuthoredBy = (pullRequest: PullRequest, login: string): boolean =>
  pullRequest.author !== null && sameLogin(pullRequest.author.login, login);

export const isStale = (pullRequest: PullRequest, thresholdDays: number, now: Date): boolean => {
  if (pullRequest.state !== 'open' || !(thresholdDays > 0)) {
    return false;
  }
  const lastActivity = Date.parse(pullRequest.lastActivityAt);
  return (
    !Number.isNaN(lastActivity) && now.getTime() - lastActivity > thresholdDays * DAY_MILLISECONDS
  );
};

export const isUntouched = (pullRequest: PullRequest): boolean =>
  isOpenNonDraft(pullRequest) && pullRequest.commentCount === 0 && pullRequest.reviewCount === 0;

export const needsReview = (pullRequest: PullRequest): boolean => {
  if (!isOpenNonDraft(pullRequest) || hasChangesRequested(pullRequest.latestReviews)) {
    return false;
  }
  const { approved, required } = approvalProgress(pullRequest);
  return pullRequest.requestedReviewers.length > 0 || (required !== null && approved < required);
};

const isTeamMember = (request: ReviewRequest, teams: readonly TeamRef[] | null): boolean =>
  request.kind === 'team' &&
  teams?.some(
    (team) =>
      sameLogin(team.organization, request.organization) && sameLogin(team.slug, request.slug),
  ) === true;

export const isReviewRequestedFrom = (
  pullRequest: PullRequest,
  viewerLogin: string,
  viewerTeams: readonly TeamRef[] | null,
): boolean =>
  pullRequest.requestedReviewers.some(
    (request) =>
      (request.kind === 'user' && sameLogin(request.login, viewerLogin)) ||
      isTeamMember(request, viewerTeams),
  );

export const hasReviewedHead = (pullRequest: PullRequest, viewerLogin: string): boolean =>
  pullRequest.latestReviews.some(
    (review) =>
      sameLogin(review.login, viewerLogin) &&
      review.commitOid === pullRequest.headRefOid &&
      (review.state === 'approved' || review.state === 'changes-requested'),
  );

export const needsMyReview = (
  pullRequest: PullRequest,
  viewerLogin: string,
  viewerTeams: readonly TeamRef[] | null,
): boolean =>
  isOpenNonDraft(pullRequest) &&
  !isAuthoredBy(pullRequest, viewerLogin) &&
  isReviewRequestedFrom(pullRequest, viewerLogin, viewerTeams) &&
  !hasReviewedHead(pullRequest, viewerLogin);

export const derivePullRequestFlags = (
  pullRequest: PullRequest,
  { viewerLogin, viewerTeams, staleThresholdDays, now }: FlagContext,
): PullRequestFlags => ({
  isDraft: isDraft(pullRequest),
  isStale: isStale(pullRequest, staleThresholdDays, now),
  isUntouched: isUntouched(pullRequest),
  hasConflicts: hasMergeConflicts(pullRequest),
  checksFailed: pullRequest.checks === 'failure',
  needsReview: needsReview(pullRequest),
  needsMyReview: needsMyReview(pullRequest, viewerLogin, viewerTeams),
  isMine: isAuthoredBy(pullRequest, viewerLogin),
  approvals: approvalProgress(pullRequest),
});
