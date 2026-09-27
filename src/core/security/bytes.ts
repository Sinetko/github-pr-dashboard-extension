const encoder = new TextEncoder();

export const utf8 = (text: string): Uint8Array<ArrayBuffer> => {
  const encoded = encoder.encode(text);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
};

export const randomBytes = (length: number): Uint8Array<ArrayBuffer> =>
  crypto.getRandomValues(new Uint8Array(length));

export const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
