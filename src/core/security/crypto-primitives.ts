import type { EncryptedBlob } from '@core/storage';
import { base64ToBytes, bytesToBase64 } from '@shared/utils';

import { randomBytes, utf8 } from './bytes';

export const KDF_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
const IV_BYTES = 12;

export const AAD = {
  passwordWrappedKey: 'pr-dashboard:dek:password:v1',
  biometricWrappedKey: 'pr-dashboard:dek:biometric:v1',
  token: 'pr-dashboard:pat:v1',
  tokenDraft: 'pr-dashboard:pat-draft:v1',
} as const;

const AES_GCM = (iv: Uint8Array<ArrayBuffer>, aad: string): AesGcmParams => ({
  name: 'AES-GCM',
  iv,
  additionalData: utf8(aad),
});

export const derivePasswordKey = async (
  password: string,
  fingerprint: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    utf8(`${fingerprint}\u0000${password}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
};

export const deriveBiometricKey = async (
  prfOutput: ArrayBuffer,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8('pr-dashboard:biometric-kek:v1') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
};

export const generateDataKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const wrapDataKey = async (
  dataKey: CryptoKey,
  wrappingKey: CryptoKey,
  aad: string,
): Promise<EncryptedBlob> => {
  const iv = randomBytes(IV_BYTES);
  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, AES_GCM(iv, aad));
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(wrapped)) };
};

export const unwrapDataKey = (
  blob: EncryptedBlob,
  wrappingKey: CryptoKey,
  aad: string,
): Promise<CryptoKey> =>
  crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(blob.data),
    wrappingKey,
    AES_GCM(base64ToBytes(blob.iv), aad),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

export const encryptText = async (
  dataKey: CryptoKey,
  plaintext: string,
  aad: string,
): Promise<EncryptedBlob> => {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(AES_GCM(iv, aad), dataKey, utf8(plaintext));
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) };
};

export const decryptText = async (
  dataKey: CryptoKey,
  blob: EncryptedBlob,
  aad: string,
): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    AES_GCM(base64ToBytes(blob.iv), aad),
    dataKey,
    base64ToBytes(blob.data),
  );
  return new TextDecoder().decode(plaintext);
};

export const exportDataKey = async (dataKey: CryptoKey): Promise<string> =>
  bytesToBase64(new Uint8Array(await crypto.subtle.exportKey('raw', dataKey)));

export const importDataKey = (encoded: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', base64ToBytes(encoded), { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
