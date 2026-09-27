export const toOriginPattern = (baseUrl: string): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hostname.includes('*') ||
    parsed.hostname === ''
  ) {
    return null;
  }
  return `${parsed.origin}/*`;
};

export const hasOriginPermission = (originPattern: string): Promise<boolean> =>
  chrome.permissions.contains({ origins: [originPattern] });

export const requestOriginPermission = (originPattern: string): Promise<boolean> =>
  chrome.permissions.request({ origins: [originPattern] });

export const releaseOriginPermission = (originPattern: string): Promise<boolean> =>
  chrome.permissions.remove({ origins: [originPattern] });
