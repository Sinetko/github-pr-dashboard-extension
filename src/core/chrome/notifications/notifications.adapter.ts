export interface DesktopNotification {
  title: string;
  message: string;
  iconPath: string;
  contextMessage?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}

export const showNotification = async (
  id: string,
  notification: DesktopNotification,
): Promise<string> =>
  chrome.notifications.create(id, {
    type: 'basic',
    title: notification.title,
    message: notification.message,
    iconUrl: chrome.runtime.getURL(notification.iconPath),
    silent: notification.silent ?? true,
    requireInteraction: notification.requireInteraction ?? false,
    ...(notification.contextMessage === undefined
      ? {}
      : { contextMessage: notification.contextMessage }),
  });

export const clearNotification = (id: string): Promise<boolean> => chrome.notifications.clear(id);

export const onNotificationClicked = (handler: (id: string) => void): (() => void) => {
  chrome.notifications.onClicked.addListener(handler);
  return () => {
    chrome.notifications.onClicked.removeListener(handler);
  };
};
