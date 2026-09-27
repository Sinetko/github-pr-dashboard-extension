export interface ManifestShape {
  permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  optional_permissions?: string[];
}

export const PERMISSION_USAGE: Record<string, RegExp> = {
  storage: /\bchrome\.storage\b/,
  alarms: /\bchrome\.alarms\b/,
  notifications: /\bchrome\.notifications\b/,
  offscreen: /\bchrome\.offscreen\b/,
};

const CONCRETE_ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?\/\*$/i;
const OPTIONAL_HTTPS_WILDCARD = 'https://*/*';

export const findManifestProblems = (manifest: ManifestShape, sourceText: string): string[] => {
  const problems: string[] = [];
  for (const origin of manifest.host_permissions ?? []) {
    if (!CONCRETE_ORIGIN.test(origin)) {
      problems.push(
        `host_permissions entry "${origin}" is not a concrete single-host https origin`,
      );
    }
  }
  for (const origin of manifest.optional_host_permissions ?? []) {
    if (origin !== OPTIONAL_HTTPS_WILDCARD && !CONCRETE_ORIGIN.test(origin)) {
      problems.push(`optional_host_permissions entry "${origin}" is not allowed`);
    }
  }
  for (const permission of [
    ...(manifest.permissions ?? []),
    ...(manifest.optional_permissions ?? []),
  ]) {
    const usage = PERMISSION_USAGE[permission];
    if (usage === undefined) {
      problems.push(`permission "${permission}" is not on the allow-list`);
    } else if (!usage.test(sourceText)) {
      problems.push(`permission "${permission}" is declared but never used`);
    }
  }
  for (const [permission, usage] of Object.entries(PERMISSION_USAGE)) {
    if (usage.test(sourceText) && !(manifest.permissions ?? []).includes(permission)) {
      problems.push(
        `source uses chrome.${permission} but the "${permission}" permission is not declared`,
      );
    }
  }
  return problems;
};
