import type { GithubHost } from '@core/github';
import type { SourceConfig } from '@core/storage';

import { applyConfigurationToSettings, type ConfigurationForm } from './configuration-form.model';
import { planHostChange } from './host-change.model';

import type { SettingsServices } from './settings-services.types';

export type SaveOutcome = { kind: 'saved' } | { kind: 'permission-denied'; origin: string };

type SaveDependencies = Pick<
  SettingsServices,
  | 'settings'
  | 'ui'
  | 'cache'
  | 'polling'
  | 'vault'
  | 'requestOriginPermission'
  | 'releaseOriginPermission'
  | 'sendMessage'
>;

export const saveConfiguration = async (
  dependencies: SaveDependencies,
  form: ConfigurationForm,
  validated: { host: GithubHost; sources: SourceConfig[] },
): Promise<SaveOutcome> => {
  const previousHost = dependencies.settings.store.getState().value.host;
  const plan = planHostChange(previousHost, validated.host);
  if (
    plan.requestOrigin !== null &&
    !(await dependencies.requestOriginPermission(plan.requestOrigin))
  ) {
    return { kind: 'permission-denied', origin: plan.requestOrigin };
  }
  const token = form.token.trim();
  if (token !== '') {
    await dependencies.vault.saveToken(token);
  }
  if (plan.hostChanged) {
    await dependencies.cache.clear();
    await dependencies.polling.clear();
  }
  await dependencies.settings.update((settings) =>
    applyConfigurationToSettings(settings, form, validated),
  );
  await dependencies.ui.update((ui) => ({ ...ui, configurationDraft: null }));
  await dependencies.vault.clearTokenDraft();
  if (plan.releaseOrigin !== null) {
    await dependencies.releaseOriginPermission(plan.releaseOrigin).catch(() => false);
  }
  void dependencies.sendMessage({ type: 'poll-now' });
  return { kind: 'saved' };
};
