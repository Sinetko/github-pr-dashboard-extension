import { useCallback, useState, type FC } from 'react';

import { Banner, Button, Screen } from '@shared/ui';

import { describeSecurityError } from '../../model/error-messages.model';

import type { BiometricOfferScreenProps } from './biometric-offer-screen.types';

export const BiometricOfferScreen: FC<BiometricOfferScreenProps> = ({ onEnroll, onSkip }) => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = useCallback(() => {
    setIsEnrolling(true);
    setError(null);
    onEnroll().catch((caught: unknown) => {
      setError(describeSecurityError(caught));
      setIsEnrolling(false);
    });
  }, [onEnroll]);

  return (
    <Screen
      title="Unlock with biometrics?"
      description="Use Touch ID, Windows Hello or your device's screen lock instead of typing your password each time the browser restarts. Your password keeps working as a fallback."
      footer={
        <>
          <Button variant="ghost" onClick={onSkip} disabled={isEnrolling}>
            Not now
          </Button>
          <Button variant="primary" onClick={handleEnroll} isLoading={isEnrolling}>
            Enable biometric unlock
          </Button>
        </>
      }
    >
      {error === null ? null : (
        <Banner tone="warning" title={error}>
          You can skip this and enable it later in Settings → Security.
        </Banner>
      )}
    </Screen>
  );
};
