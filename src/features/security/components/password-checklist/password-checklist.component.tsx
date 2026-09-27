import { ChecklistItem, ChecklistRoot } from './password-checklist.styles';

import type { PasswordChecklistProps } from './password-checklist.types';
import type { FC } from 'react';

export const PasswordChecklist: FC<PasswordChecklistProps> = ({ rules }) => (
  <ChecklistRoot aria-label="Password requirements">
    {rules.map((rule) => (
      <ChecklistItem key={rule.id} $passed={rule.passed}>
        <span aria-hidden="true">{rule.passed ? '✓' : '○'}</span>
        <span>
          {rule.label}
          <span className="visually-hidden">{rule.passed ? ' (met)' : ' (not met)'}</span>
        </span>
      </ChecklistItem>
    ))}
  </ChecklistRoot>
);
