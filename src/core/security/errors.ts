export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class VaultUnlockError extends VaultError {
  constructor() {
    super('Could not unlock the vault');
  }
}

export class VaultLockedError extends VaultError {
  constructor() {
    super('The vault is locked');
  }
}

export class VaultMissingError extends VaultError {
  constructor() {
    super('No vault has been set up');
  }
}

export class TokenMissingError extends VaultError {
  constructor() {
    super('No GitHub token has been saved');
  }
}

export class PasswordPolicyError extends VaultError {
  constructor() {
    super('Password does not meet the policy');
  }
}

export type BiometricFailure =
  'unsupported' | 'prf-unsupported' | 'cancelled' | 'not-enrolled' | 'unwrap-failed';

export class BiometricError extends VaultError {
  constructor(readonly reason: BiometricFailure) {
    super(`Biometric unlock failed: ${reason}`);
  }
}
