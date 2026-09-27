import { MINIMUM_KDF_ITERATIONS, type VaultRecord } from '@core/storage';
import { base64ToBytes, bytesToBase64 } from '@shared/utils';

import { randomBytes } from './bytes';
import {
  AAD,
  decryptText,
  derivePasswordKey,
  encryptText,
  generateDataKey,
  KDF_ITERATIONS,
  SALT_BYTES,
  unwrapDataKey,
  wrapDataKey,
} from './crypto-primitives';
import { TokenMissingError, VaultUnlockError } from './errors';

export interface CreatedVault {
  record: VaultRecord;
  dataKey: CryptoKey;
}

export const createVaultRecord = async (
  password: string,
  fingerprint: string,
  { iterations = KDF_ITERATIONS, now = new Date() }: { iterations?: number; now?: Date } = {},
): Promise<CreatedVault> => {
  if (iterations < MINIMUM_KDF_ITERATIONS) {
    throw new RangeError(`KDF iterations must be at least ${MINIMUM_KDF_ITERATIONS}`);
  }
  const salt = randomBytes(SALT_BYTES);
  const dataKey = await generateDataKey();
  const wrappingKey = await derivePasswordKey(password, fingerprint, salt, iterations);
  const timestamp = now.toISOString();
  return {
    dataKey,
    record: {
      version: 1,
      fingerprintVersion: 1,
      kdf: { algorithm: 'PBKDF2-SHA256', iterations, salt: bytesToBase64(salt) },
      passwordWrappedKey: await wrapDataKey(dataKey, wrappingKey, AAD.passwordWrappedKey),
      biometric: null,
      encryptedToken: null,
      createdAt: timestamp,
      passwordChangedAt: timestamp,
    },
  };
};

export const unlockVaultWithPassword = async (
  record: VaultRecord,
  password: string,
  fingerprint: string,
): Promise<CryptoKey> => {
  const wrappingKey = await derivePasswordKey(
    password,
    fingerprint,
    base64ToBytes(record.kdf.salt),
    record.kdf.iterations,
  );
  try {
    return await unwrapDataKey(record.passwordWrappedKey, wrappingKey, AAD.passwordWrappedKey);
  } catch {
    throw new VaultUnlockError();
  }
};

export const rewrapWithNewPassword = async (
  record: VaultRecord,
  dataKey: CryptoKey,
  newPassword: string,
  fingerprint: string,
  { iterations = Math.max(record.kdf.iterations, KDF_ITERATIONS), now = new Date() } = {},
): Promise<VaultRecord> => {
  const salt = randomBytes(SALT_BYTES);
  const wrappingKey = await derivePasswordKey(newPassword, fingerprint, salt, iterations);
  return {
    ...record,
    kdf: { algorithm: 'PBKDF2-SHA256', iterations, salt: bytesToBase64(salt) },
    passwordWrappedKey: await wrapDataKey(dataKey, wrappingKey, AAD.passwordWrappedKey),
    biometric: null,
    passwordChangedAt: now.toISOString(),
  };
};

export const sealToken = async (
  record: VaultRecord,
  dataKey: CryptoKey,
  token: string,
): Promise<VaultRecord> => ({
  ...record,
  encryptedToken: await encryptText(dataKey, token, AAD.token),
});

export const openToken = async (record: VaultRecord, dataKey: CryptoKey): Promise<string> => {
  if (record.encryptedToken === null) {
    throw new TokenMissingError();
  }
  try {
    return await decryptText(dataKey, record.encryptedToken, AAD.token);
  } catch {
    throw new VaultUnlockError();
  }
};
