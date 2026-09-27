import { Banner, Button } from '@shared/ui';

import { BannerSlot } from './status-banner.styles';

import type { StatusBannerProps } from './status-banner.types';
import type { FC } from 'react';

export const StatusBanner: FC<StatusBannerProps> = ({ status, onOpenSettings, onRetry }) => {
  switch (status.kind) {
    case 'ok':
    case 'loading':
      return null;
    case 'rate-limited':
      return (
        <BannerSlot>
          <Banner
            tone="attention"
            title={`Rate limited by GitHub — resuming at ${status.resumeAt}`}
          >
            Showing the last data we fetched.
          </Banner>
        </BannerSlot>
      );
    case 'token-invalid':
      return (
        <BannerSlot>
          <Banner
            tone="danger"
            title="GitHub rejected your token"
            action={
              <Button size="sm" onClick={onOpenSettings}>
                Update token
              </Button>
            }
          >
            It may have expired or been revoked.
          </Banner>
        </BannerSlot>
      );
    case 'error':
      return (
        <BannerSlot>
          <Banner
            tone={status.hasCache ? 'attention' : 'danger'}
            title={status.hasCache ? "Couldn't refresh" : "Couldn't load pull requests"}
            action={
              <Button size="sm" onClick={onRetry}>
                Retry
              </Button>
            }
          >
            {status.message}
            {status.cachedAt === null ? null : ` Showing data from ${status.cachedAt}.`}
          </Banner>
        </BannerSlot>
      );
    case 'truncated':
      return (
        <BannerSlot>
          <Banner tone="neutral" title="Showing a partial list">
            This source has more pull requests than we fetch at once; narrow the search to see
            everything.
          </Banner>
        </BannerSlot>
      );
  }
};
