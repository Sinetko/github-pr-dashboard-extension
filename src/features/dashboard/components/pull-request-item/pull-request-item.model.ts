import type { PullRequestFlags } from '@core/github';
import type { Tone } from '@shared/theme';

export interface StatusPill {
  key: string;
  label: string;
  tone: Tone;
  title: string;
}

export const statusPills = (
  flags: PullRequestFlags,
  checks: 'pending' | 'success' | 'failure' | 'neutral',
): StatusPill[] => {
  const pills: (StatusPill | false)[] = [
    flags.needsMyReview && {
      key: 'my-review',
      label: 'Needs my review',
      tone: 'warning',
      title: 'You are a requested reviewer',
    },
    !flags.needsMyReview &&
      flags.needsReview && {
        key: 'review',
        label: 'Needs review',
        tone: 'attention',
        title: 'Waiting on reviewers',
      },
    flags.hasConflicts && {
      key: 'conflicts',
      label: 'Conflicts',
      tone: 'danger',
      title: 'Has merge conflicts',
    },
    flags.checksFailed && {
      key: 'checks',
      label: 'Checks failing',
      tone: 'danger',
      title: 'CI checks are failing',
    },
    checks === 'pending' && {
      key: 'pending',
      label: 'Checks running',
      tone: 'neutral',
      title: 'CI checks in progress',
    },
    flags.isDraft && { key: 'draft', label: 'Draft', tone: 'neutral', title: 'Draft pull request' },
    flags.isUntouched && {
      key: 'untouched',
      label: 'Untouched',
      tone: 'accent',
      title: 'No comments or reviews yet',
    },
    flags.isStale && { key: 'stale', label: 'Stale', tone: 'neutral', title: 'No recent activity' },
  ];
  return pills.filter((pill): pill is StatusPill => pill !== false);
};

export const approvalLabel = ({
  approved,
  required,
}: PullRequestFlags['approvals']): string | null => {
  if (required !== null && required > 0) {
    return `${approved}/${required} approved`;
  }
  return approved > 0 ? `${approved} approved` : null;
};
