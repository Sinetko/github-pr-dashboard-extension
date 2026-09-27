import { StyledPill } from './pill.styles';

import type { PillProps } from './pill.types';
import type { FC } from 'react';

export const Pill: FC<PillProps> = ({ tone = 'neutral', title, leadingVisual, children }) => (
  <StyledPill $tone={tone} title={title}>
    {leadingVisual}
    {children}
  </StyledPill>
);
