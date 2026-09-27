import { createStorageArea, type StorageArea } from '@core/chrome/storage';

import {
  DEFAULT_CACHE,
  DEFAULT_META,
  DEFAULT_POLLING,
  DEFAULT_SECURITY,
  DEFAULT_SETTINGS,
  DEFAULT_UI,
  parseCache,
  parseMeta,
  parsePolling,
  parseSecurity,
  parseSettings,
  parseUi,
  SESSION_PARSERS,
  type CacheRecord,
  type MetaRecord,
  type PollingRecord,
  type SecurityRecord,
  type SessionKey,
  type SessionSchema,
  type SettingsRecord,
  type UiRecord,
} from './schema';

export interface LocalSchema {
  meta: MetaRecord;
  settings: SettingsRecord;
  security: SecurityRecord;
  polling: PollingRecord;
  cache: CacheRecord;
  ui: UiRecord;
}
export type LocalKey = keyof LocalSchema;

export const LOCAL_KEYS: readonly LocalKey[] = [
  'meta',
  'settings',
  'security',
  'polling',
  'cache',
  'ui',
];

const LOCAL_DEFINITIONS: {
  [TKey in LocalKey]: { parse: (value: unknown) => LocalSchema[TKey]; defaults: LocalSchema[TKey] };
} = {
  meta: { parse: parseMeta, defaults: DEFAULT_META },
  settings: { parse: parseSettings, defaults: DEFAULT_SETTINGS },
  security: { parse: parseSecurity, defaults: DEFAULT_SECURITY },
  polling: { parse: parsePolling, defaults: DEFAULT_POLLING },
  cache: { parse: parseCache, defaults: DEFAULT_CACHE },
  ui: { parse: parseUi, defaults: DEFAULT_UI },
};

export interface Repository<TValue> {
  readonly defaults: TValue;
  read: () => Promise<TValue>;
  write: (value: TValue) => Promise<void>;
  update: (updater: (current: TValue) => TValue) => Promise<TValue>;
  subscribe: (listener: (value: TValue) => void) => () => void;
  clear: () => Promise<void>;
}

const createRepository = <TKey extends string, TValue>(
  area: StorageArea<TKey>,
  key: TKey,
  parse: (value: unknown) => TValue,
  defaults: TValue,
): Repository<TValue> => {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <TResult>(task: () => Promise<TResult>): Promise<TResult> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const read = async (): Promise<TValue> => {
    const raw = await area.get(key);
    return raw === undefined ? structuredClone(defaults) : parse(raw);
  };
  return {
    defaults,
    read,
    write: (value) => serialize(() => area.set(key, value)),
    update: (updater) =>
      serialize(async () => {
        const next = updater(await read());
        await area.set(key, next);
        return next;
      }),
    subscribe: (listener) =>
      area.subscribe(key, (newValue) => {
        listener(newValue === undefined ? structuredClone(defaults) : parse(newValue));
      }),
    clear: () => serialize(() => area.remove(key)),
  };
};

export type LocalRepositories = { [TKey in LocalKey]: Repository<LocalSchema[TKey]> };

export const createLocalRepositories = (
  area: StorageArea<LocalKey> = createStorageArea<LocalKey>('local'),
): LocalRepositories => {
  const make = <TKey extends LocalKey>(key: TKey): Repository<LocalSchema[TKey]> =>
    createRepository(area, key, LOCAL_DEFINITIONS[key].parse, LOCAL_DEFINITIONS[key].defaults);
  return {
    meta: make('meta'),
    settings: make('settings'),
    security: make('security'),
    polling: make('polling'),
    cache: make('cache'),
    ui: make('ui'),
  };
};

export interface SessionEntry<TValue> {
  read: () => Promise<TValue>;
  write: (value: TValue) => Promise<void>;
  clear: () => Promise<void>;
  subscribe: (listener: (value: TValue) => void) => () => void;
}

export type SessionRepositories = { [TKey in SessionKey]: SessionEntry<SessionSchema[TKey]> };

export const createSessionRepositories = (
  area: StorageArea<SessionKey> = createStorageArea<SessionKey>('session'),
): SessionRepositories => {
  const make = <TKey extends SessionKey>(key: TKey): SessionEntry<SessionSchema[TKey]> => {
    const parse = SESSION_PARSERS[key];
    return {
      read: async () => parse(await area.get(key)),
      write: (value) => area.set(key, value),
      clear: () => area.remove(key),
      subscribe: (listener) =>
        area.subscribe(key, (newValue) => {
          listener(parse(newValue));
        }),
    };
  };
  return {
    vaultKey: make('vaultKey'),
    unlockedAt: make('unlockedAt'),
    lockedPromptShown: make('lockedPromptShown'),
    tokenDraft: make('tokenDraft'),
  };
};
