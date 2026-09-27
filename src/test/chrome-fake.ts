import { vi } from 'vitest';

type Listener = (...args: never[]) => unknown;

export interface EventFake<TListener extends Listener> {
  addListener: (listener: TListener) => void;
  removeListener: (listener: TListener) => void;
  hasListener: (listener: TListener) => boolean;
  hasListeners: () => boolean;
  dispatch: (...args: Parameters<TListener>) => ReturnType<TListener>[];
}

export const createEventFake = <TListener extends Listener>(): EventFake<TListener> => {
  const listeners = new Set<TListener>();
  return {
    addListener: (listener) => {
      listeners.add(listener);
    },
    removeListener: (listener) => {
      listeners.delete(listener);
    },
    hasListener: (listener) => listeners.has(listener),
    hasListeners: () => listeners.size > 0,
    dispatch: (...args) =>
      [...listeners].map((listener) => listener(...args) as ReturnType<TListener>),
  };
};

type StorageChanges = Record<string, chrome.storage.StorageChange>;
type StorageChangedListener = (changes: StorageChanges, areaName: string) => void;

const createStorageAreaFake = (
  areaName: 'local' | 'session',
  onChanged: EventFake<StorageChangedListener>,
) => {
  const data = new Map<string, unknown>();
  const clone = <TValue>(value: TValue): TValue => structuredClone(value);
  const emit = (changes: StorageChanges): void => {
    if (Object.keys(changes).length > 0) {
      onChanged.dispatch(changes, areaName);
    }
  };
  return {
    data,
    get: vi.fn((keys?: string | string[] | null) => {
      const requested =
        keys === undefined || keys === null
          ? [...data.keys()]
          : typeof keys === 'string'
            ? [keys]
            : keys;
      const result: Record<string, unknown> = {};
      for (const key of requested) {
        if (data.has(key)) {
          result[key] = clone(data.get(key));
        }
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((items: Record<string, unknown>) => {
      const changes: StorageChanges = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: clone(data.get(key)), newValue: clone(value) };
        data.set(key, clone(value));
      }
      emit(changes);
      return Promise.resolve();
    }),
    remove: vi.fn((keys: string | string[]) => {
      const changes: StorageChanges = {};
      for (const key of typeof keys === 'string' ? [keys] : keys) {
        if (data.has(key)) {
          changes[key] = { oldValue: clone(data.get(key)) };
          data.delete(key);
        }
      }
      emit(changes);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      const changes: StorageChanges = {};
      for (const [key, value] of data) {
        changes[key] = { oldValue: clone(value) };
      }
      data.clear();
      emit(changes);
      return Promise.resolve();
    }),
  };
};

export type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

export const createChromeFake = () => {
  const storageChanged = createEventFake<StorageChangedListener>();
  const messageListeners = createEventFake<RuntimeMessageListener>();
  const alarms = new Map<string, chrome.alarms.Alarm>();
  const notifications = new Map<string, chrome.notifications.NotificationOptions>();
  const grantedOrigins = new Set<string>(['https://api.github.com/*']);
  const badge = { text: '', backgroundColor: '', textColor: '', title: '' };
  const offscreenState = { hasDocument: false, createCount: 0 };
  const createdTabs: string[] = [];
  const permissionPrompt = { nextAnswer: true, requestCount: 0 };

  const chromeFake = {
    runtime: {
      id: 'fakeextensionidabcdefghijklmnop',
      getURL: vi.fn(
        (path: string) =>
          `chrome-extension://fakeextensionidabcdefghijklmnop/${path.replace(/^\//, '')}`,
      ),
      getManifest: vi.fn(() => ({ manifest_version: 3, name: 'Test', version: '1.2.3' })),
      sendMessage: vi.fn((message: unknown) => {
        if (!messageListeners.hasListeners()) {
          return Promise.reject(
            new Error('Could not establish connection. Receiving end does not exist.'),
          );
        }
        messageListeners.dispatch(
          structuredClone(message),
          { id: 'fakeextensionidabcdefghijklmnop' },
          () => undefined,
        );
        return Promise.resolve(undefined);
      }),
      onMessage: messageListeners,
      onInstalled: createEventFake<(details: chrome.runtime.InstalledDetails) => void>(),
      onStartup: createEventFake<() => void>(),
    },
    storage: {
      local: createStorageAreaFake('local', storageChanged),
      session: createStorageAreaFake('session', storageChanged),
      onChanged: storageChanged,
    },
    alarms: {
      create: vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
        const delay = info.delayInMinutes ?? info.periodInMinutes ?? 0;
        alarms.set(name, {
          name,
          scheduledTime: Date.now() + delay * 60_000,
          persistAcrossSessions: false,
          ...(info.periodInMinutes === undefined ? {} : { periodInMinutes: info.periodInMinutes }),
        });
        return Promise.resolve();
      }),
      get: vi.fn((name: string) => Promise.resolve(alarms.get(name))),
      clear: vi.fn((name: string) => Promise.resolve(alarms.delete(name))),
      onAlarm: createEventFake<(alarm: chrome.alarms.Alarm) => void>(),
    },
    notifications: {
      create: vi.fn((id: string, options: chrome.notifications.NotificationOptions) => {
        notifications.set(id, options);
        return Promise.resolve(id);
      }),
      clear: vi.fn((id: string) => Promise.resolve(notifications.delete(id))),
      getPermissionLevel: vi.fn(() => Promise.resolve('granted')),
      onClicked: createEventFake<(notificationId: string) => void>(),
      onClosed: createEventFake<(notificationId: string, byUser: boolean) => void>(),
    },
    action: {
      setBadgeText: vi.fn(({ text }: { text: string }) => {
        badge.text = text;
        return Promise.resolve();
      }),
      setBadgeBackgroundColor: vi.fn(({ color }: { color: string }) => {
        badge.backgroundColor = color;
        return Promise.resolve();
      }),
      setBadgeTextColor: vi.fn(({ color }: { color: string }) => {
        badge.textColor = color;
        return Promise.resolve();
      }),
      setTitle: vi.fn(({ title }: { title: string }) => {
        badge.title = title;
        return Promise.resolve();
      }),
      openPopup: vi.fn(() => Promise.resolve()),
    },
    offscreen: {
      Reason: { AUDIO_PLAYBACK: 'AUDIO_PLAYBACK' },
      hasDocument: vi.fn(() => Promise.resolve(offscreenState.hasDocument)),
      createDocument: vi.fn(() => {
        if (offscreenState.hasDocument) {
          return Promise.reject(new Error('Only a single offscreen document may be created.'));
        }
        offscreenState.hasDocument = true;
        offscreenState.createCount += 1;
        return Promise.resolve();
      }),
      closeDocument: vi.fn(() => {
        offscreenState.hasDocument = false;
        return Promise.resolve();
      }),
    },
    permissions: {
      contains: vi.fn(({ origins = [] }: chrome.permissions.Permissions) =>
        Promise.resolve(origins.every((origin) => grantedOrigins.has(origin))),
      ),
      request: vi.fn(({ origins = [] }: chrome.permissions.Permissions) => {
        permissionPrompt.requestCount += 1;
        if (origins.every((origin) => grantedOrigins.has(origin))) {
          return Promise.resolve(true);
        }
        if (permissionPrompt.nextAnswer) {
          for (const origin of origins) {
            grantedOrigins.add(origin);
          }
        }
        return Promise.resolve(permissionPrompt.nextAnswer);
      }),
      remove: vi.fn(({ origins = [] }: chrome.permissions.Permissions) => {
        for (const origin of origins) {
          grantedOrigins.delete(origin);
        }
        return Promise.resolve(true);
      }),
    },
    tabs: {
      create: vi.fn(({ url }: { url?: string }) => {
        if (url !== undefined) {
          createdTabs.push(url);
        }
        return Promise.resolve({ id: createdTabs.length });
      }),
    },
  };

  return {
    chrome: chromeFake,
    alarms,
    notifications,
    grantedOrigins,
    badge,
    offscreenState,
    createdTabs,
    permissionPrompt,
  };
};

export type ChromeFake = ReturnType<typeof createChromeFake>;

export const installChromeFake = (): ChromeFake => {
  const fake = createChromeFake();
  vi.stubGlobal('chrome', fake.chrome);
  return fake;
};
