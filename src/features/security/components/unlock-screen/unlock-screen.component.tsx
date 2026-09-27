import { useCallback, useState, type FC, type SubmitEvent } from 'react';

import { Banner, Button, Screen, Stack, TextField } from '@shared/ui';

import { Divider, Form, ResetRow } from './unlock-screen.styles';
import { describeSecurityError } from '../../model/error-messages.model';

import type { UnlockScreenProps } from './unlock-screen.types';

type Busy = 'none' | 'password' | 'biometric' | 'reset';

export const UnlockScreen: FC<UnlockScreenProps> = ({
  hasBiometric,
  onUnlockWithPassword,
  onUnlockWithBiometric,
  onReset,
}) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>('none');
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const run = useCallback((kind: Busy, action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    action().catch((caught: unknown) => {
      setError(describeSecurityError(caught));
      setBusy('none');
    });
  }, []);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (password !== '') {
        run('password', () => onUnlockWithPassword(password));
      }
    },
    [password, run, onUnlockWithPassword],
  );

  const handleBiometric = useCallback(() => {
    run('biometric', onUnlockWithBiometric);
  }, [run, onUnlockWithBiometric]);

  const handleConfirmReset = useCallback(() => {
    run('reset', onReset);
  }, [run, onReset]);

  return (
    <Screen
      title="Unlock PR Dashboard"
      description="Your token is encrypted. Unlock to see your pull requests."
    >
      <Form onSubmit={handleSubmit}>
        {hasBiometric ? (
          <>
            <Button
              variant="primary"
              onClick={handleBiometric}
              isLoading={busy === 'biometric'}
              disabled={busy !== 'none'}
            >
              Unlock with biometrics
            </Button>
            <Divider>or use your password</Divider>
          </>
        ) : null}
        <TextField
          id="unlock-password"
          label="Vault password"
          type="password"
          autoComplete="current-password"
          autoFocus={!hasBiometric}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        {error === null ? null : <Banner tone="danger" title={error} />}
        <Button
          type="submit"
          variant={hasBiometric ? 'secondary' : 'primary'}
          isLoading={busy === 'password'}
          disabled={password === '' || busy !== 'none'}
        >
          Unlock
        </Button>
      </Form>
      {isConfirmingReset ? (
        <Banner tone="danger" title="Reset the vault?">
          <Stack gap="sm">
            <span>
              This deletes your encrypted token and password. You'll set a new password and paste
              your token again.
            </span>
            <Stack direction="row" gap="sm">
              <Button
                size="sm"
                variant="danger"
                onClick={handleConfirmReset}
                isLoading={busy === 'reset'}
              >
                Reset vault
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsConfirmingReset(false);
                }}
              >
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Banner>
      ) : (
        <ResetRow>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsConfirmingReset(true);
            }}
          >
            Forgot password?
          </Button>
        </ResetRow>
      )}
    </Screen>
  );
};
