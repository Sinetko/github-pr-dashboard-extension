import 'styled-components';

import type { AppTheme } from './theme.types';

declare module 'styled-components' {
  export interface DefaultTheme extends AppTheme {}
}
