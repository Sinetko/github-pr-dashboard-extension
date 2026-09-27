export const SOUND_IDS = ['chime', 'ping', 'pop', 'bell'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export const SOUND_LABELS: Record<SoundId, string> = {
  chime: 'Chime',
  ping: 'Ping',
  pop: 'Pop',
  bell: 'Bell',
};

export const isSoundId = (value: unknown): value is SoundId =>
  typeof value === 'string' && (SOUND_IDS as readonly string[]).includes(value);

export const soundPath = (sound: SoundId): string => `sounds/${sound}.wav`;
