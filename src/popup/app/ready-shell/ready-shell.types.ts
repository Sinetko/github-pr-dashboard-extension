import type { PopupServices } from '../popup-services';

export interface ReadyShellProps {
  services: PopupServices;
  biometricAvailable: boolean;
  onLock: () => Promise<void>;
  onReset: () => Promise<void>;
}
