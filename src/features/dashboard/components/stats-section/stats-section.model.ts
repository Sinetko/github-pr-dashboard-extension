import type { DashboardStats } from '../../model/dashboard-view.model';

export const STAT_TILES: readonly { key: keyof DashboardStats; label: string }[] = [
  { key: 'total', label: 'Open' },
  { key: 'needsMyReview', label: 'Need my review' },
  { key: 'needsReview', label: 'Need review' },
  { key: 'mine', label: 'Mine' },
  { key: 'checksFailed', label: 'Checks failing' },
  { key: 'conflicts', label: 'Conflicts' },
  { key: 'untouched', label: 'Untouched' },
  { key: 'stale', label: 'Stale' },
  { key: 'drafts', label: 'Drafts' },
];
