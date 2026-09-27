import { vi } from 'vitest';

import {
  BiometricError,
  PasswordPolicyError,
  TokenMissingError,
  VaultError,
  VaultLockedError,
  VaultMissingError,
  VaultUnlockError,
  evaluatePassword,
  type TokenVault,
  type VaultStatus,
} from '@core/security';

export const createTokenVaultFake = () => {
  const state = {
    password: null as string | null,
    isUnlocked: false,
    token: null as string | null,
    tokenDraft: null as string | null,
    hasBiometric: false,
    biometricFailure: null as BiometricError | null,
  };
  const listeners = new Set<() => void>();
  const changed = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  const requireUnlocked = (): void => {
    if (state.password === null) {
      throw new VaultMissingError();
    }
    if (!state.isUnlocked) {
      throw new VaultLockedError();
    }
  };
  const status = (): VaultStatus =>
    state.password === null ? 'no-vault' : state.isUnlocked ? 'unlocked' : 'locked';

  const vault: TokenVault = {
    getStatus: vi.fn(() => Promise.resolve(status())),
    hasToken: vi.fn(() => Promise.resolve(state.token !== null)),
    hasBiometric: vi.fn(() => Promise.resolve(state.hasBiometric)),
    setupPassword: vi.fn((password: string) => {
      if (!evaluatePassword(password).isValid) {
        return Promise.reject(new PasswordPolicyError());
      }
      if (state.password !== null) {
        return Promise.reject(new VaultError('exists'));
      }
      state.password = password;
      state.isUnlocked = true;
      changed();
      return Promise.resolve();
    }),
    unlockWithPassword: vi.fn((password: string) => {
      if (state.password === null) {
        return Promise.reject(new VaultMissingError());
      }
      if (password !== state.password) {
        return Promise.reject(new VaultUnlockError());
      }
      state.isUnlocked = true;
      changed();
      return Promise.resolve();
    }),
    unlockWithBiometric: vi.fn(() => {
      if (state.biometricFailure !== null) {
        return Promise.reject(state.biometricFailure);
      }
      if (!state.hasBiometric) {
        return Promise.reject(new BiometricError('not-enrolled'));
      }
      state.isUnlocked = true;
      changed();
      return Promise.resolve();
    }),
    enrollBiometric: vi.fn(() => {
      if (state.biometricFailure !== null) {
        return Promise.reject(state.biometricFailure);
      }
      requireUnlocked();
      state.hasBiometric = true;
      changed();
      return Promise.resolve();
    }),
    removeBiometric: vi.fn(() => {
      state.hasBiometric = false;
      changed();
      return Promise.resolve();
    }),
    lock: vi.fn(() => {
      state.isUnlocked = false;
      state.tokenDraft = null;
      changed();
      return Promise.resolve();
    }),
    saveToken: vi.fn((token: string) => {
      requireUnlocked();
      state.token = token.trim();
      state.tokenDraft = null;
      changed();
      return Promise.resolve();
    }),
    readToken: vi.fn(() => {
      requireUnlocked();
      return state.token === null
        ? Promise.reject(new TokenMissingError())
        : Promise.resolve(state.token);
    }),
    changePassword: vi.fn((current: string, next: string) => {
      if (current !== state.password) {
        return Promise.reject(new VaultUnlockError());
      }
      if (!evaluatePassword(next).isValid) {
        return Promise.reject(new PasswordPolicyError());
      }
      state.password = next;
      state.hasBiometric = false;
      changed();
      return Promise.resolve();
    }),
    reset: vi.fn(() => {
      Object.assign(state, {
        password: null,
        isUnlocked: false,
        token: null,
        tokenDraft: null,
        hasBiometric: false,
      });
      changed();
      return Promise.resolve();
    }),
    saveTokenDraft: vi.fn((token: string) => {
      requireUnlocked();
      state.tokenDraft = token;
      return Promise.resolve();
    }),
    readTokenDraft: vi.fn(() => Promise.resolve(state.isUnlocked ? state.tokenDraft : null)),
    clearTokenDraft: vi.fn(() => {
      state.tokenDraft = null;
      return Promise.resolve();
    }),
  };

  return {
    vault,
    state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export type TokenVaultFake = ReturnType<typeof createTokenVaultFake>;
