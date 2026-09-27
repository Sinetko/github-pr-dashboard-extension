import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOUND_IDS, type SoundId } from '../src/core/audio/sound-catalog';

const SAMPLE_RATE = 22_050;
const OUTPUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'sounds');

type Voice = (time: number) => number;

const tone =
  (frequency: number, decay: number, start = 0, gain = 1): Voice =>
  (time) => {
    const local = time - start;
    if (local < 0) {
      return 0;
    }
    const attack = Math.min(1, local / 0.005);
    return gain * attack * Math.exp(-local / decay) * Math.sin(2 * Math.PI * frequency * local);
  };

const SOUNDS: Record<SoundId, { duration: number; voices: Voice[] }> = {
  chime: { duration: 0.7, voices: [tone(1318.5, 0.18), tone(1975.5, 0.25, 0.12, 0.8)] },
  ping: { duration: 0.4, voices: [tone(1760, 0.09), tone(3520, 0.04, 0, 0.2)] },
  pop: {
    duration: 0.15,
    voices: [(time) => Math.exp(-time / 0.03) * Math.sin(2 * Math.PI * (500 - 1600 * time) * time)],
  },
  bell: {
    duration: 1.2,
    voices: [tone(880, 0.35), tone(1760, 0.2, 0, 0.5), tone(2649, 0.12, 0, 0.3)],
  },
};

const encodeWav = (samples: Float32Array): Buffer => {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32_767), 44 + index * 2);
  });
  return buffer;
};

mkdirSync(OUTPUT, { recursive: true });
for (const sound of SOUND_IDS) {
  const { duration, voices } = SOUNDS[sound];
  const samples = new Float32Array(Math.round(duration * SAMPLE_RATE));
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const fadeOut = Math.min(1, (duration - time) / 0.02);
    const value = voices.reduce((sum, voice) => sum + voice(time), 0) * fadeOut;
    samples[index] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const normalized = samples.map((sample) => (sample / (peak || 1)) * 0.45);
  writeFileSync(join(OUTPUT, `${sound}.wav`), encodeWav(normalized));
  console.log(`wrote public/sounds/${sound}.wav`);
}
