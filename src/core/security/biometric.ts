import type { BiometricEnrollment, VaultRecord } from '@core/storage';
import { base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url } from '@shared/utils';

import { randomBytes } from './bytes';
import { AAD, deriveBiometricKey, unwrapDataKey, wrapDataKey } from './crypto-primitives';
import { BiometricError } from './errors';

export type CredentialsLike = Pick<CredentialsContainer, 'create' | 'get'>;

const RELYING_PARTY_NAME = 'PR Dashboard';
const PRF_SALT_BYTES = 32;

interface PrfOutputs {
  enabled?: boolean;
  results?: { first?: BufferSource };
}

const readPrf = (credential: Credential | null): { prf: PrfOutputs; rawId: ArrayBuffer } => {
  if (
    credential === null ||
    !('getClientExtensionResults' in credential) ||
    !('rawId' in credential)
  ) {
    throw new BiometricError('unsupported');
  }
  const publicKeyCredential = credential as PublicKeyCredential;
  return {
    prf: publicKeyCredential.getClientExtensionResults().prf ?? {},
    rawId: publicKeyCredential.rawId,
  };
};

const toArrayBuffer = (source: BufferSource): ArrayBuffer => {
  const view =
    source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
};

const isCancellation = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'NotAllowedError' || error.name === 'AbortError');

const evaluatePrf = async (
  credentials: CredentialsLike,
  credentialId: Uint8Array<ArrayBuffer>,
  prfSalt: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> => {
  let assertion: Credential | null;
  try {
    assertion = await credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: 'public-key', id: credentialId }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    });
  } catch (error) {
    throw new BiometricError(isCancellation(error) ? 'cancelled' : 'unsupported');
  }
  const first = readPrf(assertion).prf.results?.first;
  if (first === undefined) {
    throw new BiometricError('prf-unsupported');
  }
  return toArrayBuffer(first);
};

export const enrollBiometric = async (
  credentials: CredentialsLike,
  record: VaultRecord,
  dataKey: CryptoKey,
  now: Date = new Date(),
): Promise<VaultRecord> => {
  const prfSalt = randomBytes(PRF_SALT_BYTES);
  let created: Credential | null;
  try {
    created = await credentials.create({
      publicKey: {
        rp: { name: RELYING_PARTY_NAME },
        user: { id: randomBytes(16), name: 'pr-dashboard', displayName: 'PR Dashboard unlock' },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt } } },
      },
    });
  } catch (error) {
    throw new BiometricError(isCancellation(error) ? 'cancelled' : 'unsupported');
  }
  const { prf, rawId } = readPrf(created);
  if (prf.enabled !== true && prf.results?.first === undefined) {
    throw new BiometricError('prf-unsupported');
  }
  const credentialId = new Uint8Array(rawId);
  const output =
    prf.results?.first === undefined
      ? await evaluatePrf(credentials, credentialId, prfSalt)
      : toArrayBuffer(prf.results.first);
  const wrappingKey = await deriveBiometricKey(output, prfSalt);
  const biometric: BiometricEnrollment = {
    credentialId: bytesToBase64Url(credentialId),
    prfSalt: bytesToBase64(prfSalt),
    wrappedKey: await wrapDataKey(dataKey, wrappingKey, AAD.biometricWrappedKey),
    enrolledAt: now.toISOString(),
  };
  return { ...record, biometric };
};

export const unlockWithBiometric = async (
  credentials: CredentialsLike,
  record: VaultRecord,
): Promise<CryptoKey> => {
  const { biometric } = record;
  if (biometric === null) {
    throw new BiometricError('not-enrolled');
  }
  const prfSalt = base64ToBytes(biometric.prfSalt);
  const output = await evaluatePrf(credentials, base64UrlToBytes(biometric.credentialId), prfSalt);
  try {
    return await unwrapDataKey(
      biometric.wrappedKey,
      await deriveBiometricKey(output, prfSalt),
      AAD.biometricWrappedKey,
    );
  } catch {
    throw new BiometricError('unwrap-failed');
  }
};

export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (typeof PublicKeyCredential === 'undefined') {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};
