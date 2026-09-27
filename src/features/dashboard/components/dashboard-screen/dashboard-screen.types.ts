import type { DashboardServices } from '../../model/dashboard-services.types';

export interface DashboardScreenProps {
  services: DashboardServices;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}
