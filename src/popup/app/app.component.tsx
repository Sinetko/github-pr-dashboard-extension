import { useCallback, useEffect, useState, type FC, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { generatePassword } from '@core/security';
import { WelcomeScreen } from '@features/onboarding';
import { BiometricOfferScreen, PasswordSetupScreen, UnlockScreen } from '@features/security';
import { GeneralSettingsForm } from '@features/settings';
import { AppThemeProvider } from '@shared/theme';
import { Banner, Screen, Spinner } from '@shared/ui';

import { AppRoot, CenteredState } from './app.styles';
import { ReadyShell } from './ready-shell';
import { useOnboardingStage } from './use-onboarding-stage.hook';

import type { AppProps } from './app.types';

const nowIso = (): string => new Date().toISOString();

export const App: FC<AppProps> = ({ services }) => {
  const theme = useStore(services.settings.store, (state) => state.value.theme);
  const hasBiometric = useStore(services.vaultState.store, (state) => state.hasBiometric);
  const { stage, biometricAvailable } = useOnboardingStage(services);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    services.initialize().catch(() => {
      setInitError('Could not read extension storage. Try reopening the popup.');
    });
  }, [services]);

  const markWelcomeSeen = useCallback(() => {
    void services.meta.update((meta) => ({ ...meta, welcomeSeenAt: nowIso() }));
  }, [services]);

  const markBiometricOffered = useCallback(() => {
    void services.meta.update((meta) => ({ ...meta, biometricOfferedAt: nowIso() }));
  }, [services]);

  const afterVaultChange = useCallback(async () => {
    await services.vaultState.refresh();
    services.notifyUnlockChanged();
  }, [services]);

  const handleSetup = useCallback(
    async (password: string) => {
      await services.vault.setupPassword(password);
      await afterVaultChange();
    },
    [services, afterVaultChange],
  );

  const handleEnroll = useCallback(async () => {
    await services.vault.enrollBiometric(services.credentials);
    await services.meta.update((meta) => ({ ...meta, biometricOfferedAt: nowIso() }));
    await services.vaultState.refresh();
  }, [services]);

  const handleUnlockWithPassword = useCallback(
    async (password: string) => {
      await services.vault.unlockWithPassword(password);
      await afterVaultChange();
    },
    [services, afterVaultChange],
  );

  const handleUnlockWithBiometric = useCallback(async () => {
    await services.vault.unlockWithBiometric(services.credentials);
    await afterVaultChange();
  }, [services, afterVaultChange]);

  const handleReset = useCallback(async () => {
    await services.vault.reset();
    await services.meta.update((meta) => ({ ...meta, biometricOfferedAt: null }));
    await afterVaultChange();
  }, [services, afterVaultChange]);

  const handleLock = useCallback(async () => {
    await services.vault.lock();
    await afterVaultChange();
  }, [services, afterVaultChange]);

  const renderStage = (): ReactNode => {
    switch (stage) {
      case 'loading':
        return (
          <CenteredState>
            <Spinner size="lg" />
          </CenteredState>
        );
      case 'welcome':
        return <WelcomeScreen onContinue={markWelcomeSeen} />;
      case 'password-setup':
        return <PasswordSetupScreen onSetup={handleSetup} generatePassword={generatePassword} />;
      case 'unlock':
        return (
          <UnlockScreen
            hasBiometric={hasBiometric}
            onUnlockWithPassword={handleUnlockWithPassword}
            onUnlockWithBiometric={handleUnlockWithBiometric}
            onReset={handleReset}
          />
        );
      case 'biometric-offer':
        return <BiometricOfferScreen onEnroll={handleEnroll} onSkip={markBiometricOffered} />;
      case 'configure':
        return (
          <Screen
            title="Connect GitHub"
            description="Add a token and choose what to track. The token is encrypted before it's stored."
          >
            <GeneralSettingsForm services={services.settingsServices} mode="onboarding" />
          </Screen>
        );
      case 'ready':
        return (
          <ReadyShell
            services={services}
            biometricAvailable={biometricAvailable}
            onLock={handleLock}
            onReset={handleReset}
          />
        );
    }
  };

  return (
    <AppThemeProvider preference={theme}>
      <AppRoot>
        {initError === null ? renderStage() : <Banner tone="danger" title={initError} />}
      </AppRoot>
    </AppThemeProvider>
  );
};
