export interface SecuritySettingsPanelProps {
  hasBiometric: boolean;
  biometricAvailable: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onEnrollBiometric: () => Promise<void>;
  onRemoveBiometric: () => Promise<void>;
  onLock: () => Promise<void>;
  onReset: () => Promise<void>;
}
