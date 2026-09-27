import { vi } from 'vitest';

export interface WebauthnFakeOptions {
  prfResultsOnCreate?: boolean;
  prfSupported?: boolean;
}

const hmac = async (secret: Uint8Array<ArrayBuffer>, salt: BufferSource): Promise<ArrayBuffer> => {
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, salt);
};

const makeCredential = (rawId: Uint8Array<ArrayBuffer>, prf: object): Credential =>
  ({
    id: 'fake',
    type: 'public-key',
    rawId: rawId.buffer,
    getClientExtensionResults: () => ({ prf }),
  }) as unknown as Credential;

export const createWebauthnFake = ({
  prfResultsOnCreate = true,
  prfSupported = true,
}: WebauthnFakeOptions = {}) => {
  const secrets = new Map<string, Uint8Array<ArrayBuffer>>();
  const keyOf = (id: BufferSource): string =>
    [...new Uint8Array(id instanceof ArrayBuffer ? id : id.buffer)].join(',');
  const state = { nextError: null as DOMException | null };

  const takeError = (): void => {
    const error = state.nextError;
    state.nextError = null;
    if (error !== null) {
      throw error;
    }
  };

  const credentials = {
    create: vi.fn(async (options?: CredentialCreationOptions) => {
      takeError();
      const rawId = crypto.getRandomValues(new Uint8Array(16));
      const secret = crypto.getRandomValues(new Uint8Array(32));
      secrets.set(keyOf(rawId), secret);
      const salt = options?.publicKey?.extensions?.prf?.eval?.first;
      if (!prfSupported) {
        return makeCredential(rawId, {});
      }
      return makeCredential(
        rawId,
        prfResultsOnCreate && salt !== undefined
          ? { enabled: true, results: { first: await hmac(secret, salt) } }
          : { enabled: true },
      );
    }),
    get: vi.fn(async (options?: CredentialRequestOptions) => {
      takeError();
      const allowed = options?.publicKey?.allowCredentials?.[0]?.id;
      const salt = options?.publicKey?.extensions?.prf?.eval?.first;
      const secret = allowed === undefined ? undefined : secrets.get(keyOf(allowed));
      if (secret === undefined || salt === undefined || allowed === undefined) {
        throw new DOMException('No credential', 'NotAllowedError');
      }
      const rawId = new Uint8Array(allowed instanceof ArrayBuffer ? allowed : allowed.buffer);
      return makeCredential(
        rawId,
        prfSupported ? { results: { first: await hmac(secret, salt) } } : {},
      );
    }),
  };

  return {
    credentials,
    state,
    rotateSecrets: () => {
      for (const key of secrets.keys()) {
        secrets.set(key, crypto.getRandomValues(new Uint8Array(32)));
      }
    },
  };
};
