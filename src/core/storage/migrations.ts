import type { StorageArea } from '@core/chrome/storage';

import { CURRENT_SCHEMA_VERSION, DEFAULT_META, parseMeta } from './schema';

import type { LocalKey } from './repositories';

export type Migration = (area: StorageArea<LocalKey>) => Promise<void>;
export const MIGRATIONS: Partial<Record<number, Migration>> = {};

export type MigrationOutcome =
  | { kind: 'initialized' }
  | { kind: 'up-to-date' }
  | { kind: 'migrated'; from: number; to: number }
  | { kind: 'newer-than-supported'; version: number };

export const runMigrations = async (
  area: StorageArea<LocalKey>,
  { now = new Date(), migrations = MIGRATIONS, targetVersion = CURRENT_SCHEMA_VERSION } = {},
): Promise<MigrationOutcome> => {
  const raw = await area.get('meta');
  if (raw === undefined) {
    await area.set('meta', {
      ...DEFAULT_META,
      schemaVersion: targetVersion,
      installedAt: now.toISOString(),
    });
    return { kind: 'initialized' };
  }
  const meta = parseMeta(raw);
  if (meta.schemaVersion === targetVersion) {
    return { kind: 'up-to-date' };
  }
  if (meta.schemaVersion > targetVersion) {
    return { kind: 'newer-than-supported', version: meta.schemaVersion };
  }
  for (let version = meta.schemaVersion; version < targetVersion; version += 1) {
    const migration = migrations[version];
    if (migration === undefined) {
      throw new Error(`Missing storage migration from schema version ${version}`);
    }
    await migration(area);
    await area.set('meta', { ...meta, schemaVersion: version + 1 });
  }
  return { kind: 'migrated', from: meta.schemaVersion, to: targetVersion };
};
