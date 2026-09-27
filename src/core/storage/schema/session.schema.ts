import { parseEncryptedBlob, type EncryptedBlob } from './security.schema';

export interface SessionSchema {
  vaultKey: string | null;
  unlockedAt: string | null;
  lockedPromptShown: boolean;
  tokenDraft: EncryptedBlob | null;
}

export type SessionKey = keyof SessionSchema;

export const SESSION_PARSERS: { [TKey in SessionKey]: (value: unknown) => SessionSchema[TKey] } = {
  vaultKey: (value) => (typeof value === 'string' && value !== '' ? value : null),
  unlockedAt: (value) => (typeof value === 'string' ? value : null),
  lockedPromptShown: (value) => value === true,
  tokenDraft: parseEncryptedBlob,
};
