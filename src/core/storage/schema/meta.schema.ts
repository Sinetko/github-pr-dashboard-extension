import { asRecord, readInteger, readNullableString } from '../validate';

export const CURRENT_SCHEMA_VERSION = 1;

export interface MetaRecord {
  schemaVersion: number;
  installedAt: string | null;
  welcomeSeenAt: string | null;
  biometricOfferedAt: string | null;
}

export const DEFAULT_META: MetaRecord = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  installedAt: null,
  welcomeSeenAt: null,
  biometricOfferedAt: null,
};

export const parseMeta = (value: unknown): MetaRecord => {
  const record = asRecord(value);
  return {
    schemaVersion: readInteger(record.schemaVersion, CURRENT_SCHEMA_VERSION, {
      min: 1,
      max: 10_000,
    }),
    installedAt: readNullableString(record.installedAt),
    welcomeSeenAt: readNullableString(record.welcomeSeenAt),
    biometricOfferedAt: readNullableString(record.biometricOfferedAt),
  };
};
