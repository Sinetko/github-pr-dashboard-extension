import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installChromeFake, type ChromeFake } from '@test/chrome-fake';

import { setBadge, tryOpenPopup } from './action-badge';
import { clearAlarm, getAlarm, onAlarm, scheduleRepeatingAlarm } from './alarms';
import { isExtensionMessage, onMessage, sendMessage } from './messaging';
import { clearNotification, onNotificationClicked, showNotification } from './notifications';
import { createOffscreenDocumentManager } from './offscreen';
import {
  hasOriginPermission,
  releaseOriginPermission,
  requestOriginPermission,
  toOriginPattern,
} from './permissions';
import { getExtensionId, getExtensionUrl, getExtensionVersion, onLifecycle } from './runtime';
import { createStorageArea } from './storage';
import { openTab } from './tabs';

let fake: ChromeFake;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fake = installChromeFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage adapter', () => {
  it('gets, sets and removes typed keys without sharing references', async () => {
    const local = createStorageArea<'settings' | 'ui'>('local');
    const value = { theme: 'dark' };
    await local.set('settings', value);
    value.theme = 'mutated';
    expect(await local.get('settings')).toEqual({ theme: 'dark' });
    await local.setMany({ ui: { tab: 'all' } });
    expect(await local.getMany(['settings', 'ui'])).toEqual({
      settings: { theme: 'dark' },
      ui: { tab: 'all' },
    });
    await local.remove(['settings']);
    await local.remove('ui');
    expect(await local.get('settings')).toBeUndefined();
  });

  it('notifies subscribers only for their key and area, until unsubscribed', async () => {
    const local = createStorageArea<'settings' | 'ui'>('local');
    const session = createStorageArea<'settings'>('session');
    const listener = vi.fn();
    const unsubscribe = local.subscribe('settings', listener);
    await local.set('ui', 1);
    await session.set('settings', 2);
    await local.set('settings', 3);
    expect(listener).toHaveBeenCalledExactlyOnceWith(3, undefined);
    unsubscribe();
    await local.set('settings', 4);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('messaging adapter', () => {
  it('validates message shapes', () => {
    expect(isExtensionMessage({ type: 'poll-now' })).toBe(true);
    expect(isExtensionMessage({ type: 'play-sound', sound: 'chime' })).toBe(true);
    expect(isExtensionMessage({ type: 'play-sound' })).toBe(false);
    expect(isExtensionMessage({ type: 'drop-tables' })).toBe(false);
    expect(isExtensionMessage('poll-now')).toBe(false);
    expect(isExtensionMessage(null)).toBe(false);
  });

  it('delivers valid messages and ignores foreign senders or bad shapes', async () => {
    const handler = vi.fn();
    const unsubscribe = onMessage(handler);
    expect(await sendMessage({ type: 'poll-now' })).toBe(true);
    fake.chrome.runtime.onMessage.dispatch(
      { type: 'poll-now' },
      { id: 'other-extension' },
      () => undefined,
    );
    fake.chrome.runtime.onMessage.dispatch(
      { type: 'nope' },
      { id: fake.chrome.runtime.id },
      () => undefined,
    );
    expect(handler).toHaveBeenCalledExactlyOnceWith({ type: 'poll-now' });
    unsubscribe();
  });

  it('resolves false when nobody is listening, rethrows other errors', async () => {
    expect(await sendMessage({ type: 'unlock-changed' })).toBe(false);
    fake.chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('boom'));
    await expect(sendMessage({ type: 'unlock-changed' })).rejects.toThrow('boom');
  });

  it('logs (does not throw) when an async handler fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    onMessage(() => Promise.reject(new Error('handler failed')));
    await sendMessage({ type: 'test-notification' });
    await flush();
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe('alarms adapter', () => {
  it('schedules with a period floor and default first delay', async () => {
    await scheduleRepeatingAlarm('poll', { periodInMinutes: 0.1 });
    expect(fake.chrome.alarms.create).toHaveBeenCalledWith('poll', {
      periodInMinutes: 0.5,
      delayInMinutes: 0.5,
    });
    await scheduleRepeatingAlarm('poll', { periodInMinutes: 5, delayInMinutes: 0 });
    expect((await getAlarm('poll'))?.periodInMinutes).toBe(5);
    expect(await clearAlarm('poll')).toBe(true);
    expect(await getAlarm('poll')).toBeUndefined();
  });

  it('routes only the named alarm and survives handler errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = vi.fn(() => Promise.reject(new Error('x')));
    const unsubscribe = onAlarm('poll', handler);
    fake.chrome.alarms.onAlarm.dispatch({
      name: 'other',
      scheduledTime: 0,
      persistAcrossSessions: false,
    });
    fake.chrome.alarms.onAlarm.dispatch({
      name: 'poll',
      scheduledTime: 0,
      persistAcrossSessions: false,
    });
    await flush();
    expect(handler).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    unsubscribe();
    expect(fake.chrome.alarms.onAlarm.hasListeners()).toBe(false);
  });
});

describe('notifications adapter', () => {
  it('creates silent basic notifications with an extension icon URL', async () => {
    await showNotification('evt-1', {
      title: 'Review requested',
      message: 'repo#1',
      iconPath: 'icons/icon-128.png',
      contextMessage: 'owner/repo',
    });
    expect(fake.notifications.get('evt-1')).toMatchObject({
      type: 'basic',
      silent: true,
      requireInteraction: false,
      contextMessage: 'owner/repo',
      iconUrl: expect.stringContaining('icons/icon-128.png') as string,
    });
    expect(await clearNotification('evt-1')).toBe(true);
  });

  it('routes clicks', () => {
    const handler = vi.fn();
    const unsubscribe = onNotificationClicked(handler);
    fake.chrome.notifications.onClicked.dispatch('evt-2');
    expect(handler).toHaveBeenCalledWith('evt-2');
    unsubscribe();
    expect(fake.chrome.notifications.onClicked.hasListeners()).toBe(false);
  });
});

describe('action-badge adapter', () => {
  it('applies text, colors and title together', async () => {
    await setBadge({
      text: '3',
      backgroundColor: '#d1242f',
      textColor: '#ffffff',
      title: '3 reviews',
    });
    expect(fake.badge).toEqual({
      text: '3',
      backgroundColor: '#d1242f',
      textColor: '#ffffff',
      title: '3 reviews',
    });
  });

  it('reports whether the popup could be opened', async () => {
    expect(await tryOpenPopup()).toBe(true);
    fake.chrome.action.openPopup.mockRejectedValueOnce(new Error('No active browser window'));
    expect(await tryOpenPopup()).toBe(false);
  });
});

describe('offscreen adapter', () => {
  const manager = (): { ensure: () => Promise<void> } =>
    createOffscreenDocumentManager({
      path: 'src/offscreen/index.html',
      justification: 'Play notification sounds',
    });

  it('creates once, even for concurrent callers, and reuses an existing document', async () => {
    const offscreen = manager();
    await Promise.all([offscreen.ensure(), offscreen.ensure(), offscreen.ensure()]);
    await offscreen.ensure();
    expect(fake.offscreenState.createCount).toBe(1);
    expect(fake.chrome.offscreen.createDocument).toHaveBeenCalledOnce();
  });

  it('tolerates the "already exists" race and rethrows real failures', async () => {
    fake.chrome.offscreen.hasDocument.mockResolvedValueOnce(false);
    fake.offscreenState.hasDocument = true;
    await expect(manager().ensure()).resolves.toBeUndefined();

    fake.offscreenState.hasDocument = false;
    fake.chrome.offscreen.createDocument.mockRejectedValueOnce(new Error('Invalid URL'));
    const offscreen = manager();
    await expect(offscreen.ensure()).rejects.toThrow('Invalid URL');
    await expect(offscreen.ensure()).resolves.toBeUndefined();
  });
});

describe('permissions adapter', () => {
  it('builds concrete https origin patterns only', () => {
    expect(toOriginPattern('https://ghe.example.com/api/v3')).toBe('https://ghe.example.com/*');
    expect(toOriginPattern('https://ghe.example.com:8443')).toBe('https://ghe.example.com:8443/*');
    expect(toOriginPattern('http://ghe.example.com')).toBeNull();
    expect(toOriginPattern('https://user:pass@ghe.example.com')).toBeNull();
    expect(toOriginPattern('https://*.example.com')).toBeNull();
    expect(toOriginPattern('not a url')).toBeNull();
  });

  it('requests, checks and releases an origin', async () => {
    const origin = 'https://ghe.example.com/*';
    expect(await hasOriginPermission(origin)).toBe(false);
    expect(await requestOriginPermission(origin)).toBe(true);
    expect(await hasOriginPermission(origin)).toBe(true);
    expect(await releaseOriginPermission(origin)).toBe(true);
    expect(await hasOriginPermission(origin)).toBe(false);
    fake.permissionPrompt.nextAnswer = false;
    expect(await requestOriginPermission(origin)).toBe(false);
  });
});

describe('tabs adapter', () => {
  it('opens https URLs and refuses anything else', async () => {
    await openTab('https://github.com/owner/repo/pull/1');
    expect(fake.createdTabs).toEqual(['https://github.com/owner/repo/pull/1']);
    await expect(openTab('javascript:alert(1)')).rejects.toThrow('non-https');
    await expect(openTab('http://github.com')).rejects.toThrow('non-https');
  });
});

describe('runtime adapter', () => {
  it('exposes id, version and URLs', () => {
    expect(getExtensionId()).toBe(fake.chrome.runtime.id);
    expect(getExtensionVersion()).toBe('1.2.3');
    expect(getExtensionUrl('/sounds/chime.wav')).toMatch(/\/sounds\/chime\.wav$/);
  });

  it('normalizes install reasons and isolates handler failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onInstalled = vi.fn();
    const onStartup = vi.fn(() => {
      throw new Error('startup failed');
    });
    onLifecycle({ onInstalled, onStartup });
    fake.chrome.runtime.onInstalled.dispatch({ reason: 'install' });
    fake.chrome.runtime.onInstalled.dispatch({ reason: 'chrome_update' });
    fake.chrome.runtime.onStartup.dispatch();
    await flush();
    expect(onInstalled.mock.calls).toEqual([['install'], ['other']]);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
