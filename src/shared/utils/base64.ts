export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

export const base64ToBytes = (encoded: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export const base64UrlToBytes = (encoded: string): Uint8Array<ArrayBuffer> => {
  const standard = encoded.replaceAll('-', '+').replaceAll('_', '/');
  return base64ToBytes(standard.padEnd(Math.ceil(standard.length / 4) * 4, '='));
};
