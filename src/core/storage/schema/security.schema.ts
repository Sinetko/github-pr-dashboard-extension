import { asRecord, readInteger, readNullableString, readString } from '../validate';

export interface EncryptedBlob {
  iv: string;
  data: string;
}

export interface BiometricEnrollment {
  credentialId: string;
  prfSalt: string;
  wrappedKey: EncryptedBlob;
  enrolledAt: string;
}

export interface VaultRecord {
  version: 1;
  fingerprintVersion: 1;
  kdf: { algorithm: 'PBKDF2-SHA256'; iterations: number; salt: string };
  passwordWrappedKey: EncryptedBlob;
  biometric: BiometricEnrollment | null;
  encryptedToken: EncryptedBlob | null;
  createdAt: string;
  passwordChangedAt: string;
}

export interface SecurityRecord {
  vault: VaultRecord | null;
}

export const DEFAULT_SECURITY: SecurityRecord = { vault: null };

export const MINIMUM_KDF_ITERATIONS = 100_000;

export const parseEncryptedBlob = (value: unknown): EncryptedBlob | null => {
  const record = asRecord(value);
  return typeof record.iv === 'string' &&
    typeof record.data === 'string' &&
    record.iv !== '' &&
    record.data !== ''
    ? { iv: record.iv, data: record.data }
    : null;
};

const parseBiometric = (value: unknown): BiometricEnrollment | null => {
  const record = asRecord(value);
  const wrappedKey = parseEncryptedBlob(record.wrappedKey);
  if (
    typeof record.credentialId !== 'string' ||
    typeof record.prfSalt !== 'string' ||
    wrappedKey === null
  ) {
    return null;
  }
  return {
    credentialId: record.credentialId,
    prfSalt: record.prfSalt,
    wrappedKey,
    enrolledAt: readString(record.enrolledAt, ''),
  };
};

export const parseVault = (value: unknown): VaultRecord | null => {
  const record = asRecord(value);
  const kdf = asRecord(record.kdf);
  const passwordWrappedKey = parseEncryptedBlob(record.passwordWrappedKey);
  if (
    record.version !== 1 ||
    record.fingerprintVersion !== 1 ||
    kdf.algorithm !== 'PBKDF2-SHA256' ||
    typeof kdf.salt !== 'string' ||
    passwordWrappedKey === null
  ) {
    return null;
  }
  const iterations = readInteger(kdf.iterations, 0, { min: 1, max: 100_000_000 });
  if (iterations === 0) {
    return null;
  }
  const createdAt = readString(record.createdAt, '');
  return {
    version: 1,
    fingerprintVersion: 1,
    kdf: { algorithm: 'PBKDF2-SHA256', iterations, salt: kdf.salt },
    passwordWrappedKey,
    biometric: parseBiometric(record.biometric),
    encryptedToken: parseEncryptedBlob(record.encryptedToken),
    createdAt,
    passwordChangedAt: readNullableString(record.passwordChangedAt) ?? createdAt,
  };
};

export const parseSecurity = (value: unknown): SecurityRecord => ({
  vault: parseVault(asRecord(value).vault),
});
