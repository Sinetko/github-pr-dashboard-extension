export {
  enrollBiometric,
  isPlatformAuthenticatorAvailable,
  unlockWithBiometric,
  type CredentialsLike,
} from './biometric';
export { KDF_ITERATIONS } from './crypto-primitives';
export {
  BiometricError,
  PasswordPolicyError,
  TokenMissingError,
  VaultError,
  VaultLockedError,
  VaultMissingError,
  VaultUnlockError,
  type BiometricFailure,
} from './errors';
export {
  collectFingerprintSources,
  computeFingerprint,
  FINGERPRINT_VERSION,
  type FingerprintSources,
} from './fingerprint';
export {
  evaluatePassword,
  MINIMUM_PASSWORD_LENGTH,
  type PasswordRuleId,
  type PasswordRuleResult,
} from './password-policy';
export {
  createTokenVault,
  type TokenVault,
  type TokenVaultDependencies,
  type VaultStatus,
} from './token-vault.service';
export { generatePassword } from './password-generator';
export { createVaultStateStore, type VaultState, type VaultStateStore } from './vault-state.store';
