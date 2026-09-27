import type { PasswordRuleResult } from '@core/security';

export interface PasswordChecklistProps {
  rules: readonly PasswordRuleResult[];
}
