import { describe, expect, it } from 'vitest';

import {
  BiometricError,
  PasswordPolicyError,
  VaultUnlockError,
  type BiometricFailure,
} from '@core/security';

import { describeSecurityError } from './error-messages.model';

describe('describeSecurityError', () => {
  it('maps every known error to distinct copy, and hides unknown internals', () => {
    const reasons: BiometricFailure[] = [
      'cancelled',
      'prf-unsupported',
      'unsupported',
      'not-enrolled',
      'unwrap-failed',
    ];
    const messages = [
      describeSecurityError(new VaultUnlockError()),
      describeSecurityError(new PasswordPolicyError()),
      ...reasons.map((reason) => describeSecurityError(new BiometricError(reason))),
    ];
    expect(new Set(messages).size).toBe(messages.length);
    expect(describeSecurityError(new Error('internal detail'))).not.toContain('internal detail');
  });
});
