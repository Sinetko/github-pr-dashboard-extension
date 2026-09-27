import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VaultUnlockError } from '@core/security';
import { renderWithTheme } from '@test/render';

import { SecuritySettingsPanel, type SecuritySettingsPanelProps } from '.';

const STRONG = 'Correct-Horse-Battery-9';
const NEXT = 'Another#Strong-Passw0rd';

const setup = (overrides: Partial<SecuritySettingsPanelProps> = {}): SecuritySettingsPanelProps => {
  const props: SecuritySettingsPanelProps = {
    hasBiometric: false,
    biometricAvailable: true,
    onChangePassword: vi.fn(() => Promise.resolve()),
    onEnrollBiometric: vi.fn(() => Promise.resolve()),
    onRemoveBiometric: vi.fn(() => Promise.resolve()),
    onLock: vi.fn(() => Promise.resolve()),
    onReset: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  renderWithTheme(<SecuritySettingsPanel {...props} />);
  return props;
};

const fillPasswords = async (current: string): Promise<void> => {
  await userEvent.type(screen.getByLabelText('Current password'), current);
  await userEvent.type(screen.getByLabelText('New password'), NEXT);
  await userEvent.type(screen.getByLabelText('Confirm new password'), NEXT);
};

describe('SecuritySettingsPanel', () => {
  it('changes the password and re-prompts biometric enrollment when it was enabled', async () => {
    const props = setup({ hasBiometric: true });
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled();
    await fillPasswords(STRONG);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(props.onChangePassword).toHaveBeenCalledWith(STRONG, NEXT);
    expect(
      await screen.findByText(/Biometric unlock was turned off — enable it again/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('shows a wrong-current-password error', async () => {
    setup({ onChangePassword: vi.fn(() => Promise.reject(new VaultUnlockError())) });
    await fillPasswords('Wrong-Password-123!');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Incorrect password/)).toBeInTheDocument();
  });

  it('enrolls/removes biometrics and disables enrollment without an authenticator', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Enable biometric unlock' }));
    expect(props.onEnrollBiometric).toHaveBeenCalledOnce();
    expect(await screen.findByText('Biometric unlock enabled.')).toBeInTheDocument();
  });

  it('turns biometrics off, locks, and confirms before resetting', async () => {
    const props = setup({ hasBiometric: true });
    await userEvent.click(screen.getByRole('button', { name: 'Turn off biometric unlock' }));
    expect(props.onRemoveBiometric).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Lock now' }));
    expect(props.onLock).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Reset vault…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onReset).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Reset vault…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reset vault' }));
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('explains when no platform authenticator exists', () => {
    setup({ biometricAvailable: false });
    expect(screen.getByRole('button', { name: 'Enable biometric unlock' })).toBeDisabled();
    expect(screen.getByText(/No platform authenticator/)).toBeInTheDocument();
  });
});
