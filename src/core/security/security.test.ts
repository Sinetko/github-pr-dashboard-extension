// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLocalRepositories,
  createSessionRepositories,
  type VaultRecord,
} from '@core/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { createWebauthnFake } from '@test/webauthn-fake';

import { enrollBiometric, unlockWithBiometric } from './biometric';
import { AAD, encryptText, exportDataKey } from './crypto-primitives';
import {
  BiometricError,
  PasswordPolicyError,
  TokenMissingError,
  VaultError,
  VaultLockedError,
  VaultMissingError,
  VaultUnlockError,
} from './errors';
import {
  collectFingerprintSources,
  computeFingerprint,
  type FingerprintSources,
} from './fingerprint';
import { evaluatePassword } from './password-policy';
import { createTokenVault, type TokenVault } from './token-vault.service';
import {
  createVaultRecord,
  openToken,
  rewrapWithNewPassword,
  sealToken,
  unlockVaultWithPassword,
} from './vault';

const ITERATIONS = 100_000;
const PASSWORD = 'Correct-Horse-Battery-9';
const NEW_PASSWORD = 'Another#Strong-Passw0rd';
const FINGERPRINT = 'a'.repeat(64);
const TOKEN = 'github_pat_11ABCDEFG0123456789_secretsecretsecret';

const SOURCES: FingerprintSources = {
  platform: 'macOS',
  hardwareConcurrency: 10,
  extensionId: 'abcdefghijklmnopabcdefghijklmnop',
  architecture: 'arm',
  bitness: '64',
  model: '',
};

describe('password policy', () => {
  it('requires every rule', () => {
    expect(evaluatePassword(PASSWORD).isValid).toBe(true);
    const failing = (password: string): string[] =>
      evaluatePassword(password)
        .rules.filter((rule) => !rule.passed)
        .map((rule) => rule.id);
    expect(failing('Short-1a')).toEqual(['length']);
    expect(failing('correct-horse-battery-9')).toEqual(['uppercase']);
    expect(failing('CORRECT-HORSE-BATTERY-9')).toEqual(['lowercase']);
    expect(failing('Correct-Horse-Battery-X')).toEqual(['digit']);
    expect(failing('CorrectHorseBattery99')).toEqual(['special']);
    expect(failing('Correct-Horse-Bättery-9')).toEqual(['latin-only']);
    expect(failing('')).toEqual([
      'length',
      'uppercase',
      'lowercase',
      'digit',
      'special',
      'latin-only',
    ]);
  });
});

describe('fingerprint', () => {
  it('is a stable SHA-256 that changes with any included source', async () => {
    const base = await computeFingerprint(SOURCES);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeFingerprint({ ...SOURCES })).toBe(base);
    for (const change of [
      { extensionId: 'other' },
      { hardwareConcurrency: 8 },
      { architecture: 'x86' },
      { platform: 'Windows' },
    ]) {
      expect(await computeFingerprint({ ...SOURCES, ...change })).not.toBe(base);
    }
  });

  it('collects UA-CH hints but never userAgent/platformVersion/timezone/language', async () => {
    const getHighEntropyValues = vi.fn(() =>
      Promise.resolve({ architecture: 'arm', bitness: '64', model: '', platformVersion: '15.1.0' }),
    );
    const sources = await collectFingerprintSources(
      {
        platform: 'MacIntel',
        hardwareConcurrency: 10,
        userAgentData: { platform: 'macOS', getHighEntropyValues },
      },
      SOURCES.extensionId,
    );
    expect(sources).toEqual(SOURCES);
    expect(getHighEntropyValues).toHaveBeenCalledWith(['architecture', 'bitness', 'model']);
    expect(Object.keys(sources)).not.toContain('platformVersion');
  });

  it('degrades consistently without UA-CH', async () => {
    const withoutHints = await collectFingerprintSources(
      { platform: 'Linux x86_64', hardwareConcurrency: 4 },
      'id',
    );
    expect(withoutHints).toEqual({
      platform: 'Linux x86_64',
      hardwareConcurrency: 4,
      extensionId: 'id',
      architecture: '',
      bitness: '',
      model: '',
    });
    const rejecting = await collectFingerprintSources(
      {
        platform: 'Linux',
        hardwareConcurrency: 4,
        userAgentData: { getHighEntropyValues: () => Promise.reject(new Error('denied')) },
      },
      'id',
    );
    expect(rejecting.architecture).toBe('');
  });
});

describe('vault record', () => {
  it('unlocks only with the right password AND fingerprint, indistinguishably', async () => {
    const { record, dataKey } = await createVaultRecord(PASSWORD, FINGERPRINT, {
      iterations: ITERATIONS,
    });
    const unlocked = await unlockVaultWithPassword(record, PASSWORD, FINGERPRINT);
    expect(await exportDataKey(unlocked)).toBe(await exportDataKey(dataKey));
    const wrongPassword = await unlockVaultWithPassword(record, `${PASSWORD}x`, FINGERPRINT).catch(
      (error: unknown) => error,
    );
    const wrongDevice = await unlockVaultWithPassword(record, PASSWORD, 'b'.repeat(64)).catch(
      (error: unknown) => error,
    );
    expect(wrongPassword).toBeInstanceOf(VaultUnlockError);
    expect(wrongDevice).toBeInstanceOf(VaultUnlockError);
    expect((wrongPassword as Error).message).toBe((wrongDevice as Error).message);
  });

  it('enforces the iteration floor and uses fresh salts', async () => {
    await expect(createVaultRecord(PASSWORD, FINGERPRINT, { iterations: 1000 })).rejects.toThrow(
      RangeError,
    );
    const first = await createVaultRecord(PASSWORD, FINGERPRINT, { iterations: ITERATIONS });
    const second = await createVaultRecord(PASSWORD, FINGERPRINT, { iterations: ITERATIONS });
    expect(first.record.kdf.salt).not.toBe(second.record.kdf.salt);
    expect(first.record.kdf.iterations).toBe(ITERATIONS);
  });

  it('seals/opens the token and detects tampering or slot swapping', async () => {
    const { record, dataKey } = await createVaultRecord(PASSWORD, FINGERPRINT, {
      iterations: ITERATIONS,
    });
    await expect(openToken(record, dataKey)).rejects.toBeInstanceOf(TokenMissingError);
    const sealed = await sealToken(record, dataKey, TOKEN);
    expect(JSON.stringify(sealed)).not.toContain(TOKEN);
    expect(await openToken(sealed, dataKey)).toBe(TOKEN);

    const encrypted = sealed.encryptedToken;
    expect(encrypted).not.toBeNull();
    if (encrypted === null) {
      return;
    }
    const tampered: VaultRecord = {
      ...sealed,
      encryptedToken: { ...encrypted, data: `A${encrypted.data.slice(1)}` },
    };
    await expect(openToken(tampered, dataKey)).rejects.toBeInstanceOf(VaultUnlockError);
    const swapped: VaultRecord = {
      ...sealed,
      encryptedToken: await encryptText(dataKey, TOKEN, AAD.tokenDraft),
    };
    await expect(openToken(swapped, dataKey)).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it('re-wraps the same data key under a new password, dropping biometric', async () => {
    const { record, dataKey } = await createVaultRecord(PASSWORD, FINGERPRINT, {
      iterations: ITERATIONS,
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const sealed = {
      ...(await sealToken(record, dataKey, TOKEN)),
      biometric: {
        credentialId: 'x',
        prfSalt: 'eA==',
        wrappedKey: record.passwordWrappedKey,
        enrolledAt: '',
      },
    };
    const rewrapped = await rewrapWithNewPassword(sealed, dataKey, NEW_PASSWORD, FINGERPRINT, {
      iterations: ITERATIONS,
      now: new Date('2026-02-01T00:00:00Z'),
    });
    expect(rewrapped.biometric).toBeNull();
    expect(rewrapped.kdf.salt).not.toBe(sealed.kdf.salt);
    expect(rewrapped.passwordChangedAt).toBe('2026-02-01T00:00:00.000Z');
    await expect(unlockVaultWithPassword(rewrapped, PASSWORD, FINGERPRINT)).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
    const newKey = await unlockVaultWithPassword(rewrapped, NEW_PASSWORD, FINGERPRINT);
    expect(await openToken(rewrapped, newKey)).toBe(TOKEN);
  });
});

describe('biometric (WebAuthn PRF)', () => {
  const setup = async () => createVaultRecord(PASSWORD, FINGERPRINT, { iterations: ITERATIONS });

  it('enrolls and unlocks, with PRF results at create or only at get', async () => {
    for (const prfResultsOnCreate of [true, false]) {
      const webauthn = createWebauthnFake({ prfResultsOnCreate });
      const { record, dataKey } = await setup();
      const enrolled = await enrollBiometric(webauthn.credentials, record, dataKey);
      expect(enrolled.biometric?.credentialId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(webauthn.credentials.get).toHaveBeenCalledTimes(prfResultsOnCreate ? 0 : 1);
      const unlocked = await unlockWithBiometric(webauthn.credentials, enrolled);
      expect(await exportDataKey(unlocked)).toBe(await exportDataKey(dataKey));
    }
  });

  it('requires user verification on a platform authenticator', async () => {
    const webauthn = createWebauthnFake();
    const { record, dataKey } = await setup();
    await enrollBiometric(webauthn.credentials, record, dataKey);
    const options = webauthn.credentials.create.mock.calls[0]?.[0]?.publicKey;
    expect(options?.authenticatorSelection).toMatchObject({
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    });
  });

  it('reports typed failures', async () => {
    const { record, dataKey } = await setup();
    const reasonOf = (promise: Promise<unknown>): Promise<string> =>
      promise.then(
        () => 'resolved',
        (error: unknown) => (error instanceof BiometricError ? error.reason : 'other'),
      );

    expect(
      await reasonOf(
        enrollBiometric(createWebauthnFake({ prfSupported: false }).credentials, record, dataKey),
      ),
    ).toBe('prf-unsupported');
    const cancelling = createWebauthnFake();
    cancelling.state.nextError = new DOMException('User cancelled', 'NotAllowedError');
    expect(await reasonOf(enrollBiometric(cancelling.credentials, record, dataKey))).toBe(
      'cancelled',
    );
    const broken = createWebauthnFake();
    broken.state.nextError = new DOMException('Bad', 'SecurityError');
    expect(await reasonOf(enrollBiometric(broken.credentials, record, dataKey))).toBe(
      'unsupported',
    );
    const nullCredential = {
      create: vi.fn(() => Promise.resolve(null)),
      get: vi.fn(() => Promise.resolve(null)),
    };
    expect(await reasonOf(enrollBiometric(nullCredential, record, dataKey))).toBe('unsupported');

    expect(await reasonOf(unlockWithBiometric(createWebauthnFake().credentials, record))).toBe(
      'not-enrolled',
    );
    const webauthn = createWebauthnFake();
    const enrolled = await enrollBiometric(webauthn.credentials, record, dataKey);
    webauthn.rotateSecrets();
    expect(await reasonOf(unlockWithBiometric(webauthn.credentials, enrolled))).toBe(
      'unwrap-failed',
    );
    webauthn.state.nextError = new DOMException('cancel', 'AbortError');
    expect(await reasonOf(unlockWithBiometric(webauthn.credentials, enrolled))).toBe('cancelled');
    const noPrfOnGet = {
      create: webauthn.credentials.create,
      get: vi.fn(() => createWebauthnFake({ prfSupported: false }).credentials.create()),
    };
    expect(await reasonOf(unlockWithBiometric(noPrfOnGet, enrolled))).toBe('prf-unsupported');
  });
});

describe('token vault service', () => {
  let chromeFake: ChromeFake;
  let vault: TokenVault;
  const allStoredJson = (): string =>
    JSON.stringify([
      ...chromeFake.chrome.storage.local.data.values(),
      ...chromeFake.chrome.storage.session.data.values(),
    ]);

  beforeEach(() => {
    chromeFake = installChromeFake();
    vault = createTokenVault({
      security: createLocalRepositories().security,
      session: createSessionRepositories(),
      getFingerprint: () => Promise.resolve(FINGERPRINT),
      kdfIterations: ITERATIONS,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks no-vault → unlocked → locked → unlocked', async () => {
    expect(await vault.getStatus()).toBe('no-vault');
    await expect(vault.setupPassword('weak')).rejects.toBeInstanceOf(PasswordPolicyError);
    await vault.setupPassword(PASSWORD);
    expect(await vault.getStatus()).toBe('unlocked');
    await expect(vault.setupPassword(PASSWORD)).rejects.toBeInstanceOf(VaultError);
    await vault.lock();
    expect(await vault.getStatus()).toBe('locked');
    await expect(vault.unlockWithPassword('Wrong-Password-123!')).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
    await vault.unlockWithPassword(PASSWORD);
    expect(await vault.getStatus()).toBe('unlocked');
  });

  it('never persists the plaintext token; key material only in session storage', async () => {
    await vault.setupPassword(PASSWORD);
    await vault.saveToken(`  ${TOKEN}\n`);
    expect(await vault.hasToken()).toBe(true);
    expect(await vault.readToken()).toBe(TOKEN);
    expect(allStoredJson()).not.toContain(TOKEN);
    expect(chromeFake.chrome.storage.session.data.get('vaultKey')).toEqual(expect.any(String));
    expect(JSON.stringify([...chromeFake.chrome.storage.local.data.values()])).not.toContain(
      String(chromeFake.chrome.storage.session.data.get('vaultKey')),
    );
    await vault.lock();
    expect(chromeFake.chrome.storage.session.data.has('vaultKey')).toBe(false);
    await expect(vault.readToken()).rejects.toBeInstanceOf(VaultLockedError);
    await expect(vault.saveToken(TOKEN)).rejects.toBeInstanceOf(VaultLockedError);
  });

  it('rejects empty tokens and operations without a vault', async () => {
    await expect(vault.readToken()).rejects.toBeInstanceOf(VaultMissingError);
    await expect(vault.unlockWithPassword(PASSWORD)).rejects.toBeInstanceOf(VaultMissingError);
    await vault.setupPassword(PASSWORD);
    await expect(vault.saveToken('   ')).rejects.toThrow('empty');
    await expect(vault.readToken()).rejects.toBeInstanceOf(TokenMissingError);
  });

  it('keeps an encrypted token draft that dies with the session', async () => {
    await vault.setupPassword(PASSWORD);
    expect(await vault.readTokenDraft()).toBeNull();
    await vault.saveTokenDraft(TOKEN);
    expect(allStoredJson()).not.toContain(TOKEN);
    expect(await vault.readTokenDraft()).toBe(TOKEN);
    chromeFake.chrome.storage.session.data.set('tokenDraft', {
      iv: 'AAAAAAAAAAAAAAAA',
      data: 'AAAAAAAAAAAAAAAAAAAAAA==',
    });
    expect(await vault.readTokenDraft()).toBeNull();
    await vault.saveTokenDraft(TOKEN);
    await vault.clearTokenDraft();
    expect(await vault.readTokenDraft()).toBeNull();
    await vault.saveTokenDraft(TOKEN);
    await vault.saveToken(TOKEN);
    expect(await vault.readTokenDraft()).toBeNull();
    await vault.saveTokenDraft(TOKEN);
    await vault.lock();
    expect(await vault.readTokenDraft()).toBeNull();
  });

  it('changes password (re-authenticating) and keeps the token readable', async () => {
    await vault.setupPassword(PASSWORD);
    await vault.saveToken(TOKEN);
    await expect(vault.changePassword('Wrong-Password-123!', NEW_PASSWORD)).rejects.toBeInstanceOf(
      VaultUnlockError,
    );
    await expect(vault.changePassword(PASSWORD, 'weak')).rejects.toBeInstanceOf(
      PasswordPolicyError,
    );
    await vault.changePassword(PASSWORD, NEW_PASSWORD);
    await vault.lock();
    await expect(vault.unlockWithPassword(PASSWORD)).rejects.toBeInstanceOf(VaultUnlockError);
    await vault.unlockWithPassword(NEW_PASSWORD);
    expect(await vault.readToken()).toBe(TOKEN);
  });

  it('enrolls, uses and removes biometric unlock; password change requires re-enrollment', async () => {
    const webauthn = createWebauthnFake();
    await vault.setupPassword(PASSWORD);
    await vault.saveToken(TOKEN);
    await vault.enrollBiometric(webauthn.credentials);
    expect(await vault.hasBiometric()).toBe(true);
    await vault.lock();
    await expect(vault.enrollBiometric(webauthn.credentials)).rejects.toBeInstanceOf(
      VaultLockedError,
    );
    await vault.unlockWithBiometric(webauthn.credentials);
    expect(await vault.readToken()).toBe(TOKEN);
    await vault.changePassword(PASSWORD, NEW_PASSWORD);
    expect(await vault.hasBiometric()).toBe(false);
    await vault.enrollBiometric(webauthn.credentials);
    await vault.removeBiometric();
    expect(await vault.hasBiometric()).toBe(false);
  });

  it('treats a corrupt session key as locked, and reset wipes everything', async () => {
    await vault.setupPassword(PASSWORD);
    await vault.saveToken(TOKEN);
    chromeFake.chrome.storage.session.data.set('vaultKey', 'bm90LWEta2V5');
    expect(await vault.getStatus()).toBe('locked');
    expect(chromeFake.chrome.storage.session.data.has('vaultKey')).toBe(false);
    await vault.unlockWithPassword(PASSWORD);
    await vault.reset();
    expect(await vault.getStatus()).toBe('no-vault');
    expect(await vault.hasToken()).toBe(false);
    expect(chromeFake.chrome.storage.session.data.size).toBe(0);
  });
});

describe('isPlatformAuthenticatorAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false without WebAuthn, and reflects/guards the platform check', async () => {
    const { isPlatformAuthenticatorAvailable } = await import('./biometric');
    vi.stubGlobal('PublicKeyCredential', undefined);
    expect(await isPlatformAuthenticatorAvailable()).toBe(false);
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    });
    expect(await isPlatformAuthenticatorAvailable()).toBe(true);
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error('x')),
    });
    expect(await isPlatformAuthenticatorAvailable()).toBe(false);
  });
});
