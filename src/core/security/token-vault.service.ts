import type {
  EncryptedBlob,
  Repository,
  SecurityRecord,
  SessionRepositories,
  VaultRecord,
} from '@core/storage';

import { enrollBiometric, unlockWithBiometric, type CredentialsLike } from './biometric';
import {
  AAD,
  decryptText,
  encryptText,
  exportDataKey,
  importDataKey,
  KDF_ITERATIONS,
} from './crypto-primitives';
import { PasswordPolicyError, VaultError, VaultLockedError, VaultMissingError } from './errors';
import { evaluatePassword } from './password-policy';
import {
  createVaultRecord,
  openToken,
  rewrapWithNewPassword,
  sealToken,
  unlockVaultWithPassword,
} from './vault';

export type VaultStatus = 'no-vault' | 'locked' | 'unlocked';

export interface TokenVaultDependencies {
  security: Repository<SecurityRecord>;
  session: Pick<SessionRepositories, 'vaultKey' | 'unlockedAt' | 'tokenDraft'>;
  getFingerprint: () => Promise<string>;
  kdfIterations?: number;
  now?: () => Date;
}

export interface TokenVault {
  getStatus: () => Promise<VaultStatus>;
  hasToken: () => Promise<boolean>;
  hasBiometric: () => Promise<boolean>;
  setupPassword: (password: string) => Promise<void>;
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithBiometric: (credentials: CredentialsLike) => Promise<void>;
  enrollBiometric: (credentials: CredentialsLike) => Promise<void>;
  removeBiometric: () => Promise<void>;
  lock: () => Promise<void>;
  saveToken: (token: string) => Promise<void>;
  readToken: () => Promise<string>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reset: () => Promise<void>;
  saveTokenDraft: (token: string) => Promise<void>;
  readTokenDraft: () => Promise<string | null>;
  clearTokenDraft: () => Promise<void>;
}

export const createTokenVault = ({
  security,
  session,
  getFingerprint,
  kdfIterations = KDF_ITERATIONS,
  now = () => new Date(),
}: TokenVaultDependencies): TokenVault => {
  const readVault = async (): Promise<VaultRecord | null> => (await security.read()).vault;

  const requireVault = async (): Promise<VaultRecord> => {
    const vault = await readVault();
    if (vault === null) {
      throw new VaultMissingError();
    }
    return vault;
  };

  const loadSessionKey = async (): Promise<CryptoKey | null> => {
    const encoded = await session.vaultKey.read();
    if (encoded === null) {
      return null;
    }
    try {
      return await importDataKey(encoded);
    } catch {
      await session.vaultKey.clear();
      return null;
    }
  };

  const requireSessionKey = async (): Promise<CryptoKey> => {
    const key = await loadSessionKey();
    if (key === null) {
      throw new VaultLockedError();
    }
    return key;
  };

  const storeSessionKey = async (dataKey: CryptoKey): Promise<void> => {
    await session.vaultKey.write(await exportDataKey(dataKey));
    await session.unlockedAt.write(now().toISOString());
  };

  const writeVault = (vault: VaultRecord | null): Promise<SecurityRecord> =>
    security.update((current) => ({ ...current, vault }));

  const lock = async (): Promise<void> => {
    await session.vaultKey.clear();
    await session.unlockedAt.clear();
    await session.tokenDraft.clear();
  };

  return {
    getStatus: async () => {
      if ((await readVault()) === null) {
        return 'no-vault';
      }
      return (await loadSessionKey()) === null ? 'locked' : 'unlocked';
    },
    hasToken: async () => (await readVault())?.encryptedToken != null,
    hasBiometric: async () => (await readVault())?.biometric != null,

    setupPassword: async (password) => {
      if (!evaluatePassword(password).isValid) {
        throw new PasswordPolicyError();
      }
      if ((await readVault()) !== null) {
        throw new VaultError('A vault already exists; change the password instead');
      }
      const { record, dataKey } = await createVaultRecord(password, await getFingerprint(), {
        iterations: kdfIterations,
        now: now(),
      });
      await writeVault(record);
      await storeSessionKey(dataKey);
    },

    unlockWithPassword: async (password) => {
      const dataKey = await unlockVaultWithPassword(
        await requireVault(),
        password,
        await getFingerprint(),
      );
      await storeSessionKey(dataKey);
    },

    unlockWithBiometric: async (credentials) => {
      await storeSessionKey(await unlockWithBiometric(credentials, await requireVault()));
    },

    enrollBiometric: async (credentials) => {
      const vault = await requireVault();
      const enrolled = await enrollBiometric(credentials, vault, await requireSessionKey(), now());
      await writeVault(enrolled);
    },

    removeBiometric: async () => {
      await writeVault({ ...(await requireVault()), biometric: null });
    },

    lock,

    saveToken: async (token) => {
      const trimmed = token.trim();
      if (trimmed === '') {
        throw new VaultError('Token is empty');
      }
      const sealed = await sealToken(await requireVault(), await requireSessionKey(), trimmed);
      await writeVault(sealed);
      await session.tokenDraft.clear();
    },

    readToken: async () => openToken(await requireVault(), await requireSessionKey()),

    changePassword: async (currentPassword, newPassword) => {
      if (!evaluatePassword(newPassword).isValid) {
        throw new PasswordPolicyError();
      }
      const vault = await requireVault();
      const fingerprint = await getFingerprint();
      const dataKey = await unlockVaultWithPassword(vault, currentPassword, fingerprint);
      const rewrapped = await rewrapWithNewPassword(vault, dataKey, newPassword, fingerprint, {
        iterations: Math.max(vault.kdf.iterations, kdfIterations),
        now: now(),
      });
      await writeVault(rewrapped);
      await storeSessionKey(dataKey);
    },

    reset: async () => {
      await writeVault(null);
      await lock();
    },

    saveTokenDraft: async (token) => {
      const blob: EncryptedBlob = await encryptText(
        await requireSessionKey(),
        token,
        AAD.tokenDraft,
      );
      await session.tokenDraft.write(blob);
    },

    readTokenDraft: async () => {
      const blob = await session.tokenDraft.read();
      const dataKey = await loadSessionKey();
      if (blob === null || dataKey === null) {
        return null;
      }
      try {
        return await decryptText(dataKey, blob, AAD.tokenDraft);
      } catch {
        await session.tokenDraft.clear();
        return null;
      }
    },

    clearTokenDraft: () => session.tokenDraft.clear(),
  };
};
