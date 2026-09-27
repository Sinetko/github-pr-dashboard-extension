import {
  ScreenDescription,
  ScreenFooter,
  ScreenHeader,
  ScreenHeading,
  ScreenRoot,
  ScreenTitle,
} from './screen.styles';

import type { ScreenProps } from './screen.types';
import type { FC } from 'react';

export const Screen: FC<ScreenProps> = ({ title, description, headerAction, footer, children }) => (
  <ScreenRoot aria-label={title}>
    <ScreenHeader>
      <ScreenHeading>
        <ScreenTitle>{title}</ScreenTitle>
        {description === undefined ? null : <ScreenDescription>{description}</ScreenDescription>}
      </ScreenHeading>
      {headerAction}
    </ScreenHeader>
    {children}
    {footer === undefined ? null : <ScreenFooter>{footer}</ScreenFooter>}
  </ScreenRoot>
);
