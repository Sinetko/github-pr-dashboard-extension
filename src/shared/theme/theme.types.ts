export type ThemeName = 'light' | 'dark' | 'dimmed' | 'high-contrast-dark';
export type ThemePreference = 'system' | ThemeName;
export type ColorScheme = 'light' | 'dark';
export type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'attention';

export interface ToneColors {
  foreground: string;
  subtle: string;
  border: string;
}

export interface AppTheme {
  name: ThemeName;
  scheme: ColorScheme;
  colors: {
    background: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textMuted: string;
    textOnEmphasis: string;
    focusRing: string;
    overlay: string;
    tones: Record<Tone, ToneColors>;
  };
  space: { xxs: string; xs: string; sm: string; md: string; lg: string; xl: string };
  radii: { sm: string; md: string; pill: string };
  font: {
    family: string;
    mono: string;
    size: { xs: string; sm: string; md: string; lg: string };
    weight: { regular: number; medium: number; bold: number };
  };
  shadow: { popover: string };
  motion: { fast: string };
}
