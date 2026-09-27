export const initialsFor = (name: string): string => {
  const letters = name
    .trim()
    .split(/[\s._-]+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return letters === '' ? '?' : letters;
};
