import { useCallback, useMemo, useState, type FC, type SubmitEvent } from 'react';

import { evaluatePassword } from '@core/security';
import { Banner, Button, Stack, TextField } from '@shared/ui';

import { describeSecurityError } from '../../model/error-messages.model';
import { PasswordChecklist } from '../password-checklist';
import { Section, SectionText, SectionTitle } from './security-settings-panel.styles';

import type { SecuritySettingsPanelProps } from './security-settings-panel.types';

type Feedback = { tone: 'success' | 'danger' | 'attention'; message: string } | null;
type Action = 'none' | 'password' | 'biometric' | 'lock' | 'reset';

export const SecuritySettingsPanel: FC<SecuritySettingsPanelProps> = ({
  hasBiometric,
  biometricAvailable,
  onChangePassword,
  onEnrollBiometric,
  onRemoveBiometric,
  onLock,
  onReset,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<Action>('none');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const evaluation = useMemo(() => evaluatePassword(newPassword), [newPassword]);
  const canChange =
    currentPassword !== '' && evaluation.isValid && confirmation === newPassword && busy === 'none';

  const run = useCallback((action: Action, task: () => Promise<void>, success: Feedback) => {
    setBusy(action);
    setFeedback(null);
    task()
      .then(() => {
        setFeedback(success);
      })
      .catch((error: unknown) => {
        setFeedback({ tone: 'danger', message: describeSecurityError(error) });
      })
      .finally(() => {
        setBusy('none');
      });
  }, []);

  const handleChangePassword = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canChange) {
        return;
      }
      const hadBiometric = hasBiometric;
      run(
        'password',
        async () => {
          await onChangePassword(currentPassword, newPassword);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmation('');
        },
        hadBiometric
          ? {
              tone: 'attention',
              message: 'Password changed. Biometric unlock was turned off — enable it again below.',
            }
          : { tone: 'success', message: 'Password changed.' },
      );
    },
    [canChange, hasBiometric, run, onChangePassword, currentPassword, newPassword],
  );

  return (
    <Stack gap="lg">
      {feedback === null ? null : <Banner tone={feedback.tone} title={feedback.message} />}
      <Section aria-labelledby="change-password-title">
        <SectionTitle id="change-password-title">Change vault password</SectionTitle>
        <form onSubmit={handleChangePassword} noValidate>
          <Stack gap="sm">
            <TextField
              id="current-password"
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
              }}
            />
            <TextField
              id="new-password"
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
              }}
            />
            {newPassword === '' ? null : <PasswordChecklist rules={evaluation.rules} />}
            <TextField
              id="new-password-confirmation"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              error={
                confirmation !== '' && confirmation !== newPassword
                  ? 'Passwords do not match'
                  : null
              }
              onChange={(event) => {
                setConfirmation(event.target.value);
              }}
            />
            <div>
              <Button type="submit" disabled={!canChange} isLoading={busy === 'password'}>
                Change password
              </Button>
            </div>
          </Stack>
        </form>
      </Section>

      <Section aria-labelledby="biometric-title">
        <SectionTitle id="biometric-title">Biometric unlock</SectionTitle>
        <SectionText>
          {hasBiometric
            ? 'Enabled. Your password still works as a fallback.'
            : biometricAvailable
              ? 'Unlock with Touch ID, Windows Hello or your screen lock.'
              : 'No platform authenticator is available on this device.'}
        </SectionText>
        <div>
          {hasBiometric ? (
            <Button
              onClick={() => {
                run('biometric', onRemoveBiometric, {
                  tone: 'success',
                  message: 'Biometric unlock turned off.',
                });
              }}
              isLoading={busy === 'biometric'}
            >
              Turn off biometric unlock
            </Button>
          ) : (
            <Button
              disabled={!biometricAvailable}
              onClick={() => {
                run('biometric', onEnrollBiometric, {
                  tone: 'success',
                  message: 'Biometric unlock enabled.',
                });
              }}
              isLoading={busy === 'biometric'}
            >
              Enable biometric unlock
            </Button>
          )}
        </div>
      </Section>

      <Section aria-labelledby="lock-title">
        <SectionTitle id="lock-title">Lock</SectionTitle>
        <SectionText>
          Forget the unlocked key now. Background checks pause until you unlock again.
        </SectionText>
        <div>
          <Button
            onClick={() => {
              run('lock', onLock, null);
            }}
            isLoading={busy === 'lock'}
          >
            Lock now
          </Button>
        </div>
      </Section>

      <Section aria-labelledby="reset-title">
        <SectionTitle id="reset-title">Reset vault</SectionTitle>
        <SectionText>
          Delete the encrypted token and password. Your repositories and preferences are kept.
        </SectionText>
        {isConfirmingReset ? (
          <Stack direction="row" gap="sm">
            <Button
              variant="danger"
              onClick={() => {
                run('reset', onReset, null);
              }}
              isLoading={busy === 'reset'}
            >
              Yes, reset vault
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setIsConfirmingReset(false);
              }}
            >
              Cancel
            </Button>
          </Stack>
        ) : (
          <div>
            <Button
              variant="danger"
              onClick={() => {
                setIsConfirmingReset(true);
              }}
            >
              Reset vault…
            </Button>
          </div>
        )}
      </Section>
    </Stack>
  );
};
