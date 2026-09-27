import { BannerBody, BannerRoot, BannerTitle } from './banner.styles';

import type { BannerProps } from './banner.types';
import type { FC } from 'react';

const ASSERTIVE_TONES = new Set(['danger', 'warning']);

export const Banner: FC<BannerProps> = ({ tone = 'accent', title, children, action }) => (
  <BannerRoot $tone={tone} role={ASSERTIVE_TONES.has(tone) ? 'alert' : 'status'}>
    <BannerBody>
      <BannerTitle>{title}</BannerTitle>
      {children}
    </BannerBody>
    {action}
  </BannerRoot>
);
