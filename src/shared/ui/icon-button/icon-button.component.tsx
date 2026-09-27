import { StyledIconButton } from './icon-button.styles';

import type { IconButtonProps } from './icon-button.types';
import type { FC } from 'react';

export const IconButton: FC<IconButtonProps> = ({ label, icon, isActive = false, ...rest }) => (
  <StyledIconButton {...rest} type="button" aria-label={label} title={label} $isActive={isActive}>
    {icon}
  </StyledIconButton>
);
