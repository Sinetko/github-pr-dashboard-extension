import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithTheme } from '@test/render';

import { WelcomeScreen } from '.';

describe('WelcomeScreen', () => {
  it('explains the product and continues', async () => {
    const onContinue = vi.fn();
    renderWithTheme(<WelcomeScreen onContinue={onContinue} />);
    expect(screen.getByText('Read-only by design')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
