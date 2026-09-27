import { SPINNER_SIZES } from './spinner.model';
import { SpinnerRing } from './spinner.styles';

import type { SpinnerProps } from './spinner.types';
import type { FC } from 'react';

export const Spinner: FC<SpinnerProps> = ({ size = 'md', label = 'Loading' }) =>
  label === '' ? (
    <SpinnerRing $size={SPINNER_SIZES[size]} aria-hidden="true" />
  ) : (
    <SpinnerRing $size={SPINNER_SIZES[size]} role="status" aria-label={label} />
  );
