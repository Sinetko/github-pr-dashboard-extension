import { StackRoot } from './stack.styles';

import type { StackProps } from './stack.types';
import type { FC } from 'react';

export const Stack: FC<StackProps> = ({
  direction = 'column',
  gap = 'sm',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  as = 'div',
  children,
}) => (
  <StackRoot
    as={as}
    $direction={direction}
    $gap={gap}
    $align={align}
    $justify={justify}
    $wrap={wrap}
  >
    {children}
  </StackRoot>
);
