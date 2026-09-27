import { needsMyReview, needsReview, type PullRequest, type TeamRef } from '@core/github';

export const ERROR_FAILURE_THRESHOLD = 3;
const MAX_COUNT = 99;

export type BadgeKind = 'none' | 'locked' | 'error' | 'my-review' | 'review';

export interface BadgeState {
  kind: BadgeKind;
  text: string;
  backgroundColor: string;
  textColor: string;
  title: string;
}

export const BADGE_COLORS: Record<Exclude<BadgeKind, 'none'>, string> = {
  locked: '#6e7781',
  error: '#cf222e',
  'my-review': '#bc4c00',
  review: '#0969da',
};

export interface BadgeInputs {
  isConfigured: boolean;
  isLocked: boolean;
  consecutiveFailures: number;
  needsMyReviewCount: number;
  needsReviewCount: number;
}

const countText = (count: number): string => (count > MAX_COUNT ? `${MAX_COUNT}+` : String(count));
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const resolveBadgeState = (inputs: BadgeInputs): BadgeState => {
  const base = { textColor: '#ffffff' };
  if (!inputs.isConfigured) {
    return {
      ...base,
      kind: 'none',
      text: '',
      backgroundColor: BADGE_COLORS.review,
      title: 'PR Dashboard — finish setup',
    };
  }
  if (inputs.isLocked) {
    return {
      ...base,
      kind: 'locked',
      text: '•',
      backgroundColor: BADGE_COLORS.locked,
      title: 'PR Dashboard is locked — click to unlock',
    };
  }
  if (inputs.consecutiveFailures >= ERROR_FAILURE_THRESHOLD) {
    return {
      ...base,
      kind: 'error',
      text: '!',
      backgroundColor: BADGE_COLORS.error,
      title: "PR Dashboard can't reach GitHub — click for details",
    };
  }
  if (inputs.needsMyReviewCount > 0) {
    return {
      ...base,
      kind: 'my-review',
      text: countText(inputs.needsMyReviewCount),
      backgroundColor: BADGE_COLORS['my-review'],
      title: `${plural(inputs.needsMyReviewCount, 'pull request')} need your review`,
    };
  }
  if (inputs.needsReviewCount > 0) {
    return {
      ...base,
      kind: 'review',
      text: countText(inputs.needsReviewCount),
      backgroundColor: BADGE_COLORS.review,
      title: `${plural(inputs.needsReviewCount, 'pull request')} waiting for review`,
    };
  }
  return {
    ...base,
    kind: 'none',
    text: '',
    backgroundColor: BADGE_COLORS.review,
    title: 'PR Dashboard — nothing waiting on review',
  };
};

export const countReviewWork = (
  pullRequestLists: readonly (readonly PullRequest[])[],
  viewerLogin: string | null,
  viewerTeams: readonly TeamRef[] | null,
): { needsMyReviewCount: number; needsReviewCount: number } => {
  const unique = new Map<string, PullRequest>();
  for (const list of pullRequestLists) {
    for (const pullRequest of list) {
      unique.set(pullRequest.id, pullRequest);
    }
  }
  let needsMyReviewCount = 0;
  let needsReviewCount = 0;
  for (const pullRequest of unique.values()) {
    if (viewerLogin !== null && needsMyReview(pullRequest, viewerLogin, viewerTeams)) {
      needsMyReviewCount += 1;
    }
    if (needsReview(pullRequest)) {
      needsReviewCount += 1;
    }
  }
  return { needsMyReviewCount, needsReviewCount };
};
