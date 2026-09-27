import styled from 'styled-components';

import type { Tone } from '../../theme';

export const StyledPill = styled.span<{ $tone: Tone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.xxs};
  padding: 0 ${({ theme }) => theme.space.sm};
  min-height: 20px;
  border: 1px solid ${({ theme, $tone }) => theme.colors.tones[$tone].border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $tone }) => theme.colors.tones[$tone].subtle};
  color: ${({ theme, $tone }) => theme.colors.tones[$tone].foreground};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  line-height: 18px;
  white-space: nowrap;
`;
