import type { Viewer } from '@core/github';

import type { ConfigurationErrors, ConfigurationForm } from '../../model/configuration-form.model';

export type ConnectionTest =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; viewer: Viewer; warnings: string[] }
  | { status: 'error'; message: string };

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string };

export interface ConfigurationFormController {
  form: ConfigurationForm;
  errors: ConfigurationErrors;
  hasSavedToken: boolean;
  update: (patch: Partial<ConfigurationForm>) => void;
  connection: ConnectionTest;
  testConnection: () => void;
  saveState: SaveState;
  save: () => void;
}
