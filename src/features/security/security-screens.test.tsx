import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BiometricError, VaultUnlockError } from '@core/security';
import { renderWithTheme } from '@test/render';

import { BiometricOfferScreen, PasswordSetupScreen, UnlockScreen } from '.';

const STRONG = 'Correct-Horse-Battery-9';

describe('PasswordSetupScreen', () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps submit disabled until the policy is met and both fields match', async () => {
    const onSetup = vi.fn(() => Promise.resolve());
    renderWithTheme(<PasswordSetupScreen onSetup={onSetup} generatePassword={() => STRONG} />);
    const submit = screen.getByRole('button', { name: 'Create vault' });
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    expect(submit).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), STRONG);
    await userEvent.type(screen.getByLabelText('Confirm password'), `${STRONG}x`);
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Confirm password'), '{Backspace}');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(onSetup).toHaveBeenCalledWith(STRONG);
  });

  it('shows live requirement status', async () => {
    renderWithTheme(<PasswordSetupScreen onSetup={vi.fn()} generatePassword={() => STRONG} />);
    await userEvent.type(screen.getByLabelText('Password'), 'abc');
    const checklist = screen.getByRole('list', { name: 'Password requirements' });
    expect(checklist).toHaveTextContent('A lowercase letter (a–z) (met)');
    expect(checklist).toHaveTextContent('An uppercase letter (A–Z) (not met)');
  });

  it('generates a visible password and copies it to the clipboard', async () => {
    renderWithTheme(<PasswordSetupScreen onSetup={vi.fn()} generatePassword={() => STRONG} />);
    await userEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    expect(screen.getByLabelText('Password')).toHaveValue(STRONG);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveValue(STRONG);
    await userEvent.click(screen.getByRole('button', { name: 'Copy password' }));
    expect(writeText).toHaveBeenCalledWith(STRONG);
    expect(await screen.findByRole('button', { name: 'Copied ✓' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('reports clipboard failure and setup errors', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const onSetup = vi.fn(() => Promise.reject(new Error('boom')));
    renderWithTheme(<PasswordSetupScreen onSetup={onSetup} generatePassword={() => STRONG} />);
    await userEvent.click(screen.getByRole('button', { name: 'Generate strong password' }));
    await userEvent.click(screen.getByRole('button', { name: 'Copy password' }));
    expect(await screen.findByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create vault' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Create vault' })).toBeEnabled();
  });
});

describe('UnlockScreen', () => {
  const setup = (overrides: Partial<Parameters<typeof UnlockScreen>[0]> = {}) => {
    const props = {
      hasBiometric: false,
      onUnlockWithPassword: vi.fn(() => Promise.resolve()),
      onUnlockWithBiometric: vi.fn(() => Promise.resolve()),
      onReset: vi.fn(() => Promise.resolve()),
      ...overrides,
    };
    renderWithTheme(<UnlockScreen {...props} />);
    return props;
  };

  it('unlocks with a password and shows a wrong-password error', async () => {
    const onUnlockWithPassword = vi
      .fn()
      .mockRejectedValueOnce(new VaultUnlockError())
      .mockResolvedValueOnce(undefined);
    setup({ onUnlockWithPassword });
    expect(
      screen.queryByRole('button', { name: 'Unlock with biometrics' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Vault password'), 'wrong{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(onUnlockWithPassword).toHaveBeenLastCalledWith('wrong');
  });

  it('offers biometric unlock when enrolled and explains failures', async () => {
    const props = setup({
      hasBiometric: true,
      onUnlockWithBiometric: vi.fn(() => Promise.reject(new BiometricError('cancelled'))),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Unlock with biometrics' }));
    expect(props.onUnlockWithBiometric).toHaveBeenCalledOnce();
    expect(await screen.findByRole('alert')).toHaveTextContent('cancelled');
  });

  it('requires confirmation before resetting the vault', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onReset).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset vault' }));
    expect(props.onReset).toHaveBeenCalledOnce();
  });
});

describe('BiometricOfferScreen', () => {
  it('skips', async () => {
    const onSkip = vi.fn();
    renderWithTheme(<BiometricOfferScreen onEnroll={vi.fn()} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('enrolls, blocking skip while the prompt is open', async () => {
    const onEnroll = vi.fn(() => new Promise<void>(() => undefined));
    renderWithTheme(<BiometricOfferScreen onEnroll={onEnroll} onSkip={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enable biometric unlock' }));
    expect(onEnroll).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled();
  });

  it('shows why enrollment failed and lets the user skip', async () => {
    const onEnroll = vi.fn(() => Promise.reject(new BiometricError('prf-unsupported')));
    renderWithTheme(<BiometricOfferScreen onEnroll={onEnroll} onSkip={vi.fn()} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Enable biometric unlock' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('PRF');
    });
    expect(screen.getByRole('button', { name: 'Not now' })).toBeEnabled();
  });
});
