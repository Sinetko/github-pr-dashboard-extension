import type { VaultStatus } from '@core/security';

export type OnboardingStage =
  'loading' | 'welcome' | 'password-setup' | 'unlock' | 'biometric-offer' | 'configure' | 'ready';

export interface OnboardingFacts {
  isLoaded: boolean;
  welcomeSeen: boolean;
  vaultStatus: VaultStatus;
  hasBiometric: boolean;
  biometricOffered: boolean;
  biometricAvailable: boolean;
  hasToken: boolean;
  hasSources: boolean;
}

export const resolveOnboardingStage = (facts: OnboardingFacts): OnboardingStage => {
  if (!facts.isLoaded) {
    return 'loading';
  }
  if (!facts.welcomeSeen) {
    return 'welcome';
  }
  if (facts.vaultStatus === 'no-vault') {
    return 'password-setup';
  }
  if (facts.vaultStatus === 'locked') {
    return 'unlock';
  }
  if (!facts.biometricOffered && facts.biometricAvailable && !facts.hasBiometric) {
    return 'biometric-offer';
  }
  if (!facts.hasToken || !facts.hasSources) {
    return 'configure';
  }
  return 'ready';
};
