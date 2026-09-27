import styled from 'styled-components';

import { FLEX_VALUES } from './stack.model';

import type { AppTheme } from '../../theme';

interface StackRootProps {
  $direction: 'row' | 'column';
  $gap: keyof AppTheme['space'];
  $align: keyof typeof FLEX_VALUES;
  $justify: keyof typeof FLEX_VALUES;
  $wrap: boolean;
}

export const StackRoot = styled.div<StackRootProps>`
  display: flex;
  flex-direction: ${({ $direction }) => $direction};
  gap: ${({ theme, $gap }) => theme.space[$gap]};
  align-items: ${({ $align }) => FLEX_VALUES[$align]};
  justify-content: ${({ $justify }) => FLEX_VALUES[$justify]};
  flex-wrap: ${({ $wrap }) => ($wrap ? 'wrap' : 'nowrap')};
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
`;
