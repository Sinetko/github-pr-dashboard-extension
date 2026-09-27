import type { DashboardStats } from '../../model/dashboard-view.model';

export interface StatsSectionProps {
  stats: DashboardStats;
  isCollapsed: boolean;
  onToggle: (isOpen: boolean) => void;
}
