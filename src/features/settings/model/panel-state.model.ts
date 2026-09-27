export const SETTINGS_TABS = ['general', 'notifications', 'appearance', 'security'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type PanelState =
  { panel: 'none' } | { panel: 'settings'; tab: SettingsTab } | { panel: 'about' };

export type PanelEvent =
  | { type: 'open-settings'; tab?: SettingsTab }
  | { type: 'open-about' }
  | { type: 'select-tab'; tab: SettingsTab }
  | { type: 'close' };

export const INITIAL_PANEL_STATE: PanelState = { panel: 'none' };

export const panelReducer = (state: PanelState, event: PanelEvent): PanelState => {
  switch (event.type) {
    case 'open-settings':
      return {
        panel: 'settings',
        tab: event.tab ?? (state.panel === 'settings' ? state.tab : 'general'),
      };
    case 'open-about':
      return { panel: 'about' };
    case 'select-tab':
      return state.panel === 'settings' ? { panel: 'settings', tab: event.tab } : state;
    case 'close':
      return INITIAL_PANEL_STATE;
  }
};
