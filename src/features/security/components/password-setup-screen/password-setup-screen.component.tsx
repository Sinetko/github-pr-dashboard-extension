import { useCallback, useMemo, useState, type FC, type SubmitEvent } from 'react';

import { evaluatePassword } from '@core/security';
import { useCopyToClipboard } from '@shared/hooks';
import { Banner, Button, Screen, TextField } from '@shared/ui';

import { describeSecurityError } from '../../model/error-messages.model';
import { PasswordChecklist } from '../password-checklist';
import { Form, Note, ToolRow } from './password-setup-screen.styles';

import type { PasswordSetupScreenProps } from './password-setup-screen.types';

const COPY_LABELS = { idle: 'Copy password', copied: 'Copied ✓', failed: 'Copy failed' } as const;

export const PasswordSetupScreen: FC<PasswordSetupScreenProps> = ({
  onSetup,
  generatePassword,
}) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copy, state: copyState } = useCopyToClipboard();

  const evaluation = useMemo(() => evaluatePassword(password), [password]);
  const isMismatch = confirmation !== '' && confirmation !== password;
  const canSubmit = evaluation.isValid && confirmation === password && !isSubmitting;

  const handleGenerate = useCallback(() => {
    const generated = generatePassword();
    setPassword(generated);
    setConfirmation(generated);
    setIsVisible(true);
  }, [generatePassword]);

  const handleCopy = useCallback(() => {
    void copy(password);
  }, [copy, password]);

  const toggleVisibility = useCallback(() => {
    setIsVisible((visible) => !visible);
  }, []);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) {
        return;
      }
      setIsSubmitting(true);
      setError(null);
      onSetup(password).catch((caught: unknown) => {
        setError(describeSecurityError(caught));
        setIsSubmitting(false);
      });
    },
    [canSubmit, onSetup, password],
  );

  return (
    <Screen
      title="Create a vault password"
      description="Your GitHub token will be encrypted with this password. It can't be recovered — if you forget it, you'll reset the vault and enter a new token."
    >
      <Form onSubmit={handleSubmit} noValidate>
        <TextField
          id="vault-password"
          label="Password"
          type={isVisible ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          trailingAction={
            <Button size="sm" variant="ghost" onClick={toggleVisibility} aria-pressed={isVisible}>
              {isVisible ? 'Hide' : 'Show'}
            </Button>
          }
        />
        <PasswordChecklist rules={evaluation.rules} />
        <TextField
          id="vault-password-confirmation"
          label="Confirm password"
          type={isVisible ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmation}
          error={isMismatch ? 'Passwords do not match' : null}
          onChange={(event) => {
            setConfirmation(event.target.value);
          }}
        />
        <ToolRow>
          <Button size="sm" onClick={handleGenerate}>
            Generate strong password
          </Button>
          <Button size="sm" onClick={handleCopy} disabled={password === ''}>
            {COPY_LABELS[copyState]}
          </Button>
        </ToolRow>
        <Note>Tip: copy the password into your password manager before continuing.</Note>
        {error === null ? null : <Banner tone="danger" title={error} />}
        <Button type="submit" variant="primary" disabled={!canSubmit} isLoading={isSubmitting}>
          Create vault
        </Button>
      </Form>
    </Screen>
  );
};
