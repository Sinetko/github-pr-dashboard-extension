import type { DashboardItem } from '../../model/dashboard-view.model';

export interface PullRequestListProps {
  items: readonly DashboardItem[];
  now: Date;
  onOpen: (url: string) => void;
}
