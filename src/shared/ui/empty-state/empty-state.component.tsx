import { EmptyStateDescription, EmptyStateRoot, EmptyStateTitle } from './empty-state.styles';

import type { EmptyStateProps } from './empty-state.types';
import type { FC } from 'react';

export const EmptyState: FC<EmptyStateProps> = ({ title, description, action, visual }) => (
  <EmptyStateRoot>
    {visual}
    <EmptyStateTitle>{title}</EmptyStateTitle>
    {description === undefined ? null : (
      <EmptyStateDescription>{description}</EmptyStateDescription>
    )}
    {action}
  </EmptyStateRoot>
);
