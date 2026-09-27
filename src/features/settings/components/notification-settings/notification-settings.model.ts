import type { NotificationType } from '@core/storage';

export const NOTIFICATION_TYPE_COPY: Record<
  NotificationType,
  { label: string; description: string }
> = {
  'review-requested': {
    label: 'Review requested',
    description: 'Someone asks you (or your team) to review a PR.',
  },
  'review-received': {
    label: 'Review on my PR',
    description: 'Your PR is approved, gets changes requested, or a review comment.',
  },
  'checks-failed': {
    label: 'Checks failed',
    description: 'CI on a PR you track flips to failing.',
  },
  'merge-conflict': { label: 'Merge conflict', description: 'A PR you track develops a conflict.' },
  'new-comment': {
    label: 'New comment on my PR',
    description: 'Someone else comments on your PR.',
  },
  'pr-closed': { label: 'Merged or closed', description: 'A PR you track is merged or closed.' },
};

export const NO_SOUND = 'none';
