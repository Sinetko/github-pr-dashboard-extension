import { useCallback, type FC, type SubmitEvent } from 'react';

import { GITHUB_DOT_COM, parseEnterpriseHost, tokenCreationUrl } from '@core/github';
import { Banner, Button, Select, Stack, Switch, TextField } from '@shared/ui';

import { useConfigurationForm } from '../../hooks/use-configuration-form';
import { POLL_INTERVAL_OPTIONS } from '../../model/configuration-form.model';
import { RepositoryListEditor } from '../repository-list-editor';
import { TokenHelp } from '../token-help';
import { ErrorText, Form, HintText, Legend, Section } from './general-settings-form.styles';

import type { GeneralSettingsFormProps } from './general-settings-form.types';

const INTERVAL_OPTIONS = POLL_INTERVAL_OPTIONS.map((minutes) => ({
  value: String(minutes),
  label: minutes === 1 ? 'Every minute' : `Every ${minutes} minutes`,
}));

export const GeneralSettingsForm: FC<GeneralSettingsFormProps> = ({ services, mode, onSaved }) => {
  const { form, errors, hasSavedToken, update, connection, testConnection, saveState, save } =
    useConfigurationForm(services, onSaved);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      save();
    },
    [save],
  );

  const openTokenPage = useCallback(() => {
    const host = form.useEnterprise
      ? (parseEnterpriseHost(form.hostInput) ?? GITHUB_DOT_COM)
      : GITHUB_DOT_COM;
    void services.openTab(tokenCreationUrl(host, form.tokenKind));
  }, [form.useEnterprise, form.hostInput, form.tokenKind, services]);

  return (
    <Form onSubmit={handleSubmit} noValidate aria-label="Connection settings">
      <Section>
        <Legend>GitHub host</Legend>
        <Switch
          id="use-enterprise"
          label="Use GitHub Enterprise Server"
          description="Off = github.com"
          checked={form.useEnterprise}
          onChange={(useEnterprise) => {
            update({ useEnterprise });
          }}
        />
        {form.useEnterprise ? (
          <TextField
            id="enterprise-host"
            label="Enterprise host"
            placeholder="github.example.com"
            value={form.hostInput}
            error={errors.host ?? null}
            spellCheck={false}
            autoCapitalize="off"
            hint="The browser will ask permission to access this host."
            onChange={(event) => {
              update({ hostInput: event.target.value });
            }}
          />
        ) : null}
      </Section>

      <Section>
        <Legend>Personal access token</Legend>
        <TokenHelp
          tokenKind={form.tokenKind}
          onTokenKindChange={(tokenKind) => {
            update({ tokenKind });
          }}
          onOpenTokenPage={openTokenPage}
        />
        <TextField
          id="github-token"
          label={hasSavedToken ? 'Replace token' : 'Token'}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            hasSavedToken ? 'Saved and encrypted — paste to replace' : 'github_pat_… or ghp_…'
          }
          value={form.token}
          error={errors.token ?? null}
          onChange={(event) => {
            update({ token: event.target.value });
          }}
          trailingAction={
            <Button size="sm" onClick={testConnection} isLoading={connection.status === 'testing'}>
              Test
            </Button>
          }
        />
        {connection.status === 'success' ? (
          <Banner
            tone={connection.warnings.length > 0 ? 'attention' : 'success'}
            title={`Connected as @${connection.viewer.login}`}
          >
            {connection.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </Banner>
        ) : null}
        {connection.status === 'error' ? <Banner tone="danger" title={connection.message} /> : null}
      </Section>

      <Section>
        <Legend>What to track</Legend>
        <HintText>Repositories to watch (owner/repository):</HintText>
        <RepositoryListEditor
          values={form.repositoryInputs}
          errors={errors.repositories ?? {}}
          onChange={(repositoryInputs) => {
            update({ repositoryInputs });
          }}
        />
        <TextField
          id="search-query"
          label="Saved search (optional)"
          placeholder="is:open review-requested:@me"
          value={form.searchQuery}
          spellCheck={false}
          hint="Any GitHub pull request search, for a dynamic cross-repository view."
          onChange={(event) => {
            update({ searchQuery: event.target.value });
          }}
        />
        {errors.sources === undefined ? null : <ErrorText role="alert">{errors.sources}</ErrorText>}
      </Section>

      <Section>
        <Legend>Refresh</Legend>
        <Stack direction="row" gap="md" align="end" wrap>
          <Select
            id="poll-interval"
            label="Check for updates"
            options={INTERVAL_OPTIONS}
            value={String(form.pollIntervalMinutes)}
            onChange={(value) => {
              update({ pollIntervalMinutes: Number(value) });
            }}
          />
          <TextField
            id="stale-threshold"
            label="Stale after (days)"
            type="number"
            min={1}
            max={90}
            value={String(form.staleThresholdDays)}
            error={errors.staleThresholdDays ?? null}
            onChange={(event) => {
              update({ staleThresholdDays: Number(event.target.value) });
            }}
          />
        </Stack>
      </Section>

      {saveState.status === 'error' ? <Banner tone="danger" title={saveState.message} /> : null}
      {saveState.status === 'saved' && mode === 'settings' ? (
        <Banner tone="success" title="Settings saved" />
      ) : null}
      <Button type="submit" variant="primary" isLoading={saveState.status === 'saving'}>
        {mode === 'onboarding' ? 'Save and open dashboard' : 'Save'}
      </Button>
    </Form>
  );
};
