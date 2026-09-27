import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { describeGithubError, GITHUB_DOT_COM } from '@core/github';
import { useDebouncedValue } from '@shared/hooks';

import { DRAFT_DEBOUNCE_MILLISECONDS, scopeWarnings } from './use-configuration-form.model';
import {
  draftFromForm,
  formFromSettings,
  validateConfiguration,
  type ConfigurationErrors,
  type ConfigurationForm,
} from '../../model/configuration-form.model';
import { saveConfiguration } from '../../model/save-configuration';

import type {
  ConfigurationFormController,
  ConnectionTest,
  SaveState,
} from './use-configuration-form.types';
import type { SettingsServices } from '../../model/settings-services.types';

const NO_ERRORS: ConfigurationErrors = {};

export const useConfigurationForm = (
  services: SettingsServices,
  onSaved?: () => void,
): ConfigurationFormController => {
  const settings = useStore(services.settings.store, (state) => state.value);
  const hasSavedToken = useStore(services.vaultState.store, (state) => state.hasToken);
  const [form, setForm] = useState<ConfigurationForm>(() =>
    formFromSettings(settings, services.ui.store.getState().value.configurationDraft),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [connection, setConnection] = useState<ConnectionTest>({ status: 'idle' });
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  useEffect(() => {
    let isCurrent = true;
    void services.vault.readTokenDraft().then((token) => {
      if (isCurrent && token !== null) {
        setForm((current) => (current.token === '' ? { ...current, token } : current));
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [services]);

  const persistDraft = useCallback(
    (snapshot: ConfigurationForm) => {
      void services.ui.update((ui) => ({
        ...ui,
        configurationDraft: draftFromForm(snapshot, new Date()),
      }));
      if (snapshot.token.trim() !== '') {
        void services.vault.saveTokenDraft(snapshot.token.trim()).catch(() => undefined);
      }
    },
    [services],
  );

  const debouncedForm = useDebouncedValue(form, DRAFT_DEBOUNCE_MILLISECONDS);
  useEffect(() => {
    if (isDirty) {
      persistDraft(debouncedForm);
    }
  }, [debouncedForm, isDirty, persistDraft]);

  const validation = useMemo(
    () => validateConfiguration(form, { hasSavedToken }),
    [form, hasSavedToken],
  );

  const update = useCallback((patch: Partial<ConfigurationForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setIsDirty(true);
    setSaveState({ status: 'idle' });
  }, []);

  const testConnection = useCallback(() => {
    const snapshot = form;
    const host = validation.isValid
      ? validation.host
      : snapshot.useEnterprise
        ? null
        : GITHUB_DOT_COM;
    if (host === null) {
      setShowErrors(true);
      return;
    }
    setConnection({ status: 'testing' });
    persistDraft(snapshot);
    const run = async (): Promise<void> => {
      if (
        host.kind === 'enterprise' &&
        !(await services.requestOriginPermission(`${host.origin}/*`))
      ) {
        setConnection({
          status: 'error',
          message: `Permission to access ${host.origin} was not granted.`,
        });
        return;
      }
      const token =
        snapshot.token.trim() !== ''
          ? snapshot.token.trim()
          : hasSavedToken
            ? await services.vault.readToken()
            : '';
      if (token === '') {
        setConnection({ status: 'error', message: 'Paste a token first.' });
        return;
      }
      const viewer = await services.testConnection(host, token);
      setConnection({
        status: 'success',
        viewer,
        warnings: scopeWarnings(viewer, snapshot.tokenKind),
      });
    };
    run().catch((error: unknown) => {
      setConnection({ status: 'error', message: describeGithubError(error).message });
    });
  }, [form, validation, hasSavedToken, persistDraft, services]);

  const save = useCallback(() => {
    setShowErrors(true);
    if (!validation.isValid) {
      return;
    }
    const snapshot = form;
    persistDraft(snapshot);
    setSaveState({ status: 'saving' });
    saveConfiguration(services, snapshot, validation)
      .then((outcome) => {
        if (outcome.kind === 'permission-denied') {
          setSaveState({
            status: 'error',
            message: `Permission to access ${outcome.origin.replace('/*', '')} is required to use this host.`,
          });
          return;
        }
        setIsDirty(false);
        setForm((current) => ({ ...current, token: '' }));
        setSaveState({ status: 'saved' });
        onSaved?.();
      })
      .catch(() => {
        setSaveState({
          status: 'error',
          message: 'Could not save settings. Is the vault still unlocked?',
        });
      });
  }, [form, validation, persistDraft, services, onSaved]);

  return {
    form,
    errors: showErrors ? validation.errors : NO_ERRORS,
    hasSavedToken,
    update,
    connection,
    testConnection,
    saveState,
    save,
  };
};
