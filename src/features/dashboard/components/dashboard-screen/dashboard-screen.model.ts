import type { DashboardTab, SourceConfig } from '@core/storage';
import type { TabItem } from '@shared/ui';

import { authorTab } from '../../model/dashboard-view.model';

import type { DashboardView } from '../../model/dashboard-view.model';

export const DASHBOARD_ID_PREFIX = 'dashboard';

export const sourceLabel = (source: SourceConfig): string =>
  source.kind === 'repository' ? `${source.owner}/${source.name}` : `Search: ${source.query}`;

export const tabItems = (view: DashboardView): TabItem<DashboardTab>[] => [
  { value: 'all', label: 'All', count: view.counts.all },
  { value: 'needs-review', label: 'Needs review', count: view.counts.needsReview },
  { value: 'needs-my-review', label: 'Needs my review', count: view.counts.needsMyReview },
  ...view.authors.map((author) => ({
    value: authorTab(author.login),
    label: author.login,
    count: author.count,
  })),
];
