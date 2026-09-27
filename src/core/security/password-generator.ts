const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '!#$%&*+-=?@^_~';
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

const randomIndex = (max: number): number => {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) {
      return value % max;
    }
  }
};

const pick = (alphabet: string): string => alphabet.charAt(randomIndex(alphabet.length));

export const generatePassword = (length = 24): string => {
  if (length < 15) {
    throw new RangeError('Generated passwords must satisfy the 15-character minimum');
  }
  const characters = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (characters.length < length) {
    characters.push(pick(ALL));
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    const current = characters[index] ?? '';
    characters[index] = characters[swap] ?? '';
    characters[swap] = current;
  }
  return characters.join('');
};
