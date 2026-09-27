import type { DashboardStatus } from '../../model/dashboard-status.model';

export interface StatusBannerProps {
  status: DashboardStatus;
  onOpenSettings: () => void;
  onRetry: () => void;
}
