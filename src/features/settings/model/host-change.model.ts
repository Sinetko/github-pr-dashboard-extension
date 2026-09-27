import { isSameHost, type GithubHost } from '@core/github';

export interface HostChangePlan {
  hostChanged: boolean;
  requestOrigin: string | null;
  releaseOrigin: string | null;
}

const originPatternOf = (host: GithubHost): string | null =>
  host.kind === 'enterprise' ? `${host.origin}/*` : null;

export const planHostChange = (previous: GithubHost, next: GithubHost): HostChangePlan => {
  const hostChanged = !isSameHost(previous, next);
  return {
    hostChanged,
    requestOrigin: originPatternOf(next),
    releaseOrigin: hostChanged ? originPatternOf(previous) : null,
  };
};
