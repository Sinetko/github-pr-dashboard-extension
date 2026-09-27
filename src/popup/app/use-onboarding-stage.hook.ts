import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { resolveOnboardingStage, type OnboardingStage } from '@features/onboarding';

import type { PopupServices } from './popup-services';

export const useOnboardingStage = (
  services: PopupServices,
): { stage: OnboardingStage; biometricAvailable: boolean } => {
  const meta = useStore(services.meta.store);
  const settings = useStore(services.settings.store);
  const vaultState = useStore(services.vaultState.store);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void services.isBiometricAvailable().then((available) => {
      if (isCurrent) {
        setBiometricAvailable(available);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [services]);

  const stage = useMemo(
    () =>
      resolveOnboardingStage({
        isLoaded:
          meta.isHydrated &&
          settings.isHydrated &&
          vaultState.isLoaded &&
          biometricAvailable !== null,
        welcomeSeen: meta.value.welcomeSeenAt !== null,
        vaultStatus: vaultState.status,
        hasBiometric: vaultState.hasBiometric,
        biometricOffered: meta.value.biometricOfferedAt !== null,
        biometricAvailable: biometricAvailable === true,
        hasToken: vaultState.hasToken,
        hasSources: settings.value.sources.length > 0,
      }),
    [meta, settings, vaultState, biometricAvailable],
  );
  return { stage, biometricAvailable: biometricAvailable === true };
};
