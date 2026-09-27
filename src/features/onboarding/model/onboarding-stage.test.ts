import { describe, expect, it } from 'vitest';

import { resolveOnboardingStage, type OnboardingFacts } from './onboarding-stage.model';

const READY: OnboardingFacts = {
  isLoaded: true,
  welcomeSeen: true,
  vaultStatus: 'unlocked',
  hasBiometric: false,
  biometricOffered: true,
  biometricAvailable: true,
  hasToken: true,
  hasSources: true,
};

describe('resolveOnboardingStage', () => {
  it.each<[Partial<OnboardingFacts>, string]>([
    [{ isLoaded: false }, 'loading'],
    [{ welcomeSeen: false, vaultStatus: 'no-vault' }, 'welcome'],
    [{ vaultStatus: 'no-vault', hasToken: false }, 'password-setup'],
    [{ vaultStatus: 'locked' }, 'unlock'],
    [{ biometricOffered: false }, 'biometric-offer'],
    [{ biometricOffered: false, biometricAvailable: false }, 'ready'],
    [{ biometricOffered: false, hasBiometric: true }, 'ready'],
    [{ hasToken: false }, 'configure'],
    [{ hasSources: false }, 'configure'],
    [{}, 'ready'],
  ])('%j → %s', (overrides, expected) => {
    expect(resolveOnboardingStage({ ...READY, ...overrides })).toBe(expected);
  });

  it('asks to unlock before re-offering configuration', () => {
    expect(resolveOnboardingStage({ ...READY, vaultStatus: 'locked', hasToken: false })).toBe(
      'unlock',
    );
  });
});
