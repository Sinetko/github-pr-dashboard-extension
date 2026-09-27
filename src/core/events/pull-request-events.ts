import {
  hasMergeConflicts,
  isAuthoredBy,
  needsMyReview,
  type PullRequest,
  type ReviewState,
  type TeamRef,
} from '@core/github';
import type { NotificationType } from '@core/storage';

export interface PullRequestEvent {
  type: NotificationType;
  key: string;
  pullRequest: PullRequest;
  title: string;
  message: string;
}

export interface DiffContext {
  viewerLogin: string;
  viewerTeams: readonly TeamRef[] | null;
}

const REVIEW_TITLES: Record<ReviewState, string> = {
  approved: 'Your PR was approved',
  'changes-requested': 'Changes requested on your PR',
  commented: 'New review on your PR',
  dismissed: 'A review on your PR was dismissed',
};

const isLater = (next: string | undefined, previous: string | undefined): boolean =>
  next !== undefined && (previous === undefined || Date.parse(next) > Date.parse(previous));

const sameLogin = (left: string | null, right: string): boolean =>
  left !== null && left.toLowerCase() === right.toLowerCase();

export const diffPullRequests = (
  previous: readonly PullRequest[] | undefined,
  next: readonly PullRequest[],
  { viewerLogin, viewerTeams }: DiffContext,
): PullRequestEvent[] => {
  if (previous === undefined || viewerLogin === '') {
    return [];
  }
  const previousById = new Map(previous.map((pullRequest) => [pullRequest.id, pullRequest]));
  const events: PullRequestEvent[] = [];

  for (const current of next) {
    const before = previousById.get(current.id);
    const isMine = isAuthoredBy(current, viewerLogin);
    const where = `${current.repository.owner}/${current.repository.name} #${current.number}`;

    if (before?.state === 'open' && current.state !== 'open') {
      events.push({
        type: 'pr-closed',
        key: `pr-closed|${current.id}`,
        pullRequest: current,
        title: current.state === 'merged' ? 'Pull request merged' : 'Pull request closed',
        message: `${where}: ${current.title}`,
      });
      continue;
    }
    if (current.state !== 'open') {
      continue;
    }

    if (
      needsMyReview(current, viewerLogin, viewerTeams) &&
      (before === undefined || !needsMyReview(before, viewerLogin, viewerTeams))
    ) {
      events.push({
        type: 'review-requested',
        key: `review-requested|${current.id}|${current.headRefOid}`,
        pullRequest: current,
        title: 'Review requested',
        message: `${where}: ${current.title}`,
      });
    }
    if (!isMine || before === undefined) {
      continue;
    }

    const review = current.lastReview;
    if (
      review !== null &&
      !sameLogin(review.login, viewerLogin) &&
      isLater(review.submittedAt, before.lastReview?.submittedAt)
    ) {
      events.push({
        type: 'review-received',
        key: `review-received|${current.id}|${review.login.toLowerCase()}|${review.submittedAt}`,
        pullRequest: current,
        title: REVIEW_TITLES[review.state],
        message: `${review.login} on ${where}: ${current.title}`,
      });
    }
    if (current.checks === 'failure' && before.checks !== 'failure') {
      events.push({
        type: 'checks-failed',
        key: `checks-failed|${current.id}|${current.headRefOid}`,
        pullRequest: current,
        title: 'Checks failed on your PR',
        message: `${where}: ${current.title}`,
      });
    }
    if (hasMergeConflicts(current) && !hasMergeConflicts(before)) {
      events.push({
        type: 'merge-conflict',
        key: `merge-conflict|${current.id}|${current.headRefOid}`,
        pullRequest: current,
        title: 'Merge conflict on your PR',
        message: `${where}: ${current.title}`,
      });
    }
    const comment = current.lastComment;
    if (
      comment !== null &&
      !sameLogin(comment.login, viewerLogin) &&
      current.commentCount > before.commentCount &&
      isLater(comment.createdAt, before.lastComment?.createdAt)
    ) {
      events.push({
        type: 'new-comment',
        key: `new-comment|${current.id}|${comment.createdAt}`,
        pullRequest: current,
        title: 'New comment on your PR',
        message: `${comment.login ?? 'Someone'} on ${where}: ${current.title}`,
      });
    }
  }
  return events;
};
