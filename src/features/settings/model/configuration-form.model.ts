import {
  parseEnterpriseHost,
  parseRepositorySource,
  GITHUB_DOT_COM,
  type GithubHost,
  type TokenKind,
} from '@core/github';
import {
  POLL_INTERVAL_LIMITS,
  repositorySourceId,
  searchSourceId,
  STALE_THRESHOLD_LIMITS,
  type ConfigurationDraft,
  type SettingsRecord,
  type SourceConfig,
} from '@core/storage';

export interface ConfigurationForm {
  useEnterprise: boolean;
  hostInput: string;
  tokenKind: TokenKind;
  token: string;
  repositoryInputs: string[];
  searchQuery: string;
  pollIntervalMinutes: number;
  staleThresholdDays: number;
}

export interface ConfigurationErrors {
  host?: string;
  token?: string;
  sources?: string;
  repositories?: Partial<Record<number, string>>;
  pollIntervalMinutes?: string;
  staleThresholdDays?: string;
}

export type ValidatedConfiguration =
  | { isValid: true; host: GithubHost; sources: SourceConfig[]; errors: ConfigurationErrors }
  | { isValid: false; errors: ConfigurationErrors };

export const POLL_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30, 60] as const;

export const formFromSettings = (
  settings: SettingsRecord,
  draft: ConfigurationDraft | null,
): ConfigurationForm => {
  const repositories = settings.sources.filter((source) => source.kind === 'repository');
  const search = settings.sources.find((source) => source.kind === 'search');
  const base: ConfigurationForm = {
    useEnterprise: settings.host.kind === 'enterprise',
    hostInput: settings.host.kind === 'enterprise' ? settings.host.origin : '',
    tokenKind: settings.tokenKind,
    token: '',
    repositoryInputs: repositories.map((source) => `${source.owner}/${source.name}`),
    searchQuery: search?.query ?? '',
    pollIntervalMinutes: settings.pollIntervalMinutes,
    staleThresholdDays: settings.staleThresholdDays,
  };
  return draft === null
    ? base
    : {
        ...base,
        useEnterprise: draft.useEnterprise,
        hostInput: draft.hostInput,
        tokenKind: draft.tokenKind,
        repositoryInputs: draft.sourceInputs,
        searchQuery: draft.searchQuery,
      };
};

export const draftFromForm = (form: ConfigurationForm, now: Date): ConfigurationDraft => ({
  hostInput: form.hostInput,
  useEnterprise: form.useEnterprise,
  tokenKind: form.tokenKind,
  sourceInputs: form.repositoryInputs,
  searchQuery: form.searchQuery,
  savedAt: now.toISOString(),
});

const TOKEN_SHAPE = /^[A-Za-z0-9_]{20,255}$/;

export const validateConfiguration = (
  form: ConfigurationForm,
  { hasSavedToken }: { hasSavedToken: boolean },
): ValidatedConfiguration => {
  const errors: ConfigurationErrors = {};
  const host = form.useEnterprise ? parseEnterpriseHost(form.hostInput) : GITHUB_DOT_COM;
  if (host === null) {
    errors.host = 'Enter an https GitHub Enterprise Server address, e.g. github.example.com';
  }
  const token = form.token.trim();
  if (token === '' && !hasSavedToken) {
    errors.token = 'Paste a personal access token';
  } else if (token !== '' && !TOKEN_SHAPE.test(token)) {
    errors.token = "That doesn't look like a GitHub token";
  }

  const repositoryErrors: Partial<Record<number, string>> = {};
  const sources: SourceConfig[] = [];
  const seen = new Set<string>();
  form.repositoryInputs.forEach((input, index) => {
    if (input.trim() === '') {
      return;
    }
    const repository = parseRepositorySource(input);
    if (repository === null) {
      repositoryErrors[index] = 'Use the owner/repository format';
      return;
    }
    const id = repositorySourceId(repository.owner, repository.name);
    if (!seen.has(id)) {
      seen.add(id);
      sources.push({ id, kind: 'repository', ...repository });
    }
  });
  if (Object.keys(repositoryErrors).length > 0) {
    errors.repositories = repositoryErrors;
  }
  const query = form.searchQuery.trim();
  if (query !== '') {
    sources.push({ id: searchSourceId(query), kind: 'search', label: 'Saved search', query });
  }
  if (sources.length === 0 && errors.repositories === undefined) {
    errors.sources = 'Add at least one repository or a saved search';
  }
  if (
    !Number.isInteger(form.pollIntervalMinutes) ||
    form.pollIntervalMinutes < POLL_INTERVAL_LIMITS.min ||
    form.pollIntervalMinutes > POLL_INTERVAL_LIMITS.max
  ) {
    errors.pollIntervalMinutes = `Between ${POLL_INTERVAL_LIMITS.min} and ${POLL_INTERVAL_LIMITS.max} minutes`;
  }
  if (
    !Number.isInteger(form.staleThresholdDays) ||
    form.staleThresholdDays < STALE_THRESHOLD_LIMITS.min ||
    form.staleThresholdDays > STALE_THRESHOLD_LIMITS.max
  ) {
    errors.staleThresholdDays = `Between ${STALE_THRESHOLD_LIMITS.min} and ${STALE_THRESHOLD_LIMITS.max} days`;
  }
  return host !== null && Object.keys(errors).length === 0
    ? { isValid: true, host, sources, errors }
    : { isValid: false, errors };
};

export const applyConfigurationToSettings = (
  settings: SettingsRecord,
  form: ConfigurationForm,
  validated: { host: GithubHost; sources: SourceConfig[] },
): SettingsRecord => ({
  ...settings,
  host: validated.host,
  tokenKind: form.tokenKind,
  sources: validated.sources,
  activeSourceId: validated.sources.some((source) => source.id === settings.activeSourceId)
    ? settings.activeSourceId
    : (validated.sources[0]?.id ?? null),
  pollIntervalMinutes: form.pollIntervalMinutes,
  staleThresholdDays: form.staleThresholdDays,
});
