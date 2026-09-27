import { BiometricError, PasswordPolicyError, VaultUnlockError } from '@core/security';

export const describeSecurityError = (error: unknown): string => {
  if (error instanceof VaultUnlockError) {
    return 'Incorrect password. (If this browser profile or device changed, the vault cannot be opened here — reset it and re-enter your token.)';
  }
  if (error instanceof PasswordPolicyError) {
    return 'That password does not meet every requirement.';
  }
  if (error instanceof BiometricError) {
    switch (error.reason) {
      case 'cancelled':
        return 'Biometric prompt was cancelled.';
      case 'prf-unsupported':
        return 'This authenticator does not support the secure key extension (PRF) needed for unlock.';
      case 'unsupported':
        return 'Biometric unlock is not available on this device.';
      case 'not-enrolled':
        return 'Biometric unlock is not set up.';
      case 'unwrap-failed':
        return 'Biometric unlock failed — use your password, then re-enroll biometrics in Settings.';
    }
  }
  return 'Something went wrong. Please try again.';
};
