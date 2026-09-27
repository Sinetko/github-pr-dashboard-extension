export interface UnlockScreenProps {
  hasBiometric: boolean;
  onUnlockWithPassword: (password: string) => Promise<void>;
  onUnlockWithBiometric: () => Promise<void>;
  onReset: () => Promise<void>;
}
