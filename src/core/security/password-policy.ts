export type PasswordRuleId =
  'length' | 'uppercase' | 'lowercase' | 'digit' | 'special' | 'latin-only';

export interface PasswordRuleResult {
  id: PasswordRuleId;
  label: string;
  passed: boolean;
}

export const MINIMUM_PASSWORD_LENGTH = 15;

const RULES: readonly { id: PasswordRuleId; label: string; test: (password: string) => boolean }[] =
  [
    {
      id: 'length',
      label: `At least ${MINIMUM_PASSWORD_LENGTH} characters`,
      test: (password) => password.length >= MINIMUM_PASSWORD_LENGTH,
    },
    {
      id: 'uppercase',
      label: 'An uppercase letter (A–Z)',
      test: (password) => /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'A lowercase letter (a–z)',
      test: (password) => /[a-z]/.test(password),
    },
    { id: 'digit', label: 'A digit (0–9)', test: (password) => /\d/.test(password) },
    {
      id: 'special',
      label: 'A special character (!@#$…)',
      test: (password) => /[!-/:-@[-`{-~]/.test(password),
    },
    {
      id: 'latin-only',
      label: 'Latin letters, digits and symbols only',
      test: (password) => password.length > 0 && /^[\x20-\x7E]+$/.test(password),
    },
  ];

export const evaluatePassword = (
  password: string,
): { rules: PasswordRuleResult[]; isValid: boolean } => {
  const rules = RULES.map(({ id, label, test }) => ({ id, label, passed: test(password) }));
  return { rules, isValid: rules.every((rule) => rule.passed) };
};
