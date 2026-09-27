import type { DashboardItem } from '../../model/dashboard-view.model';

export interface PullRequestItemProps {
  item: DashboardItem;
  now: Date;
  onOpen: (url: string) => void;
}
