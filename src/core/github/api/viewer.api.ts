import { GithubApiError } from '../client/errors';
import { githubFetch } from '../client/github-fetch';
import { fetchAllPages } from '../client/pagination';
import { endpointsFor } from '../domain/host';

import type { GithubSession } from './session';
import type { TeamRef, Viewer } from '../domain/pull-request.types';
import type { RestTeam, RestUser } from '../rest/rest.types';

const parseScopes = (header: string | null): string[] | null =>
  header === null
    ? null
    : header
        .split(',')
        .map((scope) => scope.trim())
        .filter((scope) => scope !== '');

export const fetchViewer = async (session: GithubSession): Promise<Viewer> => {
  const { restBaseUrl } = endpointsFor(session.host);
  const response = await githubFetch<RestUser>(restBaseUrl, await session.getToken(), '/user');
  if (response.notModified) {
    throw new GithubApiError(304, '', 'GET /user');
  }
  return {
    login: response.data.login,
    name: response.data.name,
    avatarUrl: response.data.avatar_url,
    scopes: parseScopes(response.scopes),
  };
};

export const fetchViewerTeams = async (session: GithubSession): Promise<TeamRef[] | null> => {
  const { restBaseUrl } = endpointsFor(session.host);
  try {
    const result = await fetchAllPages<RestTeam>(
      restBaseUrl,
      await session.getToken(),
      '/user/teams?per_page=100',
      { pageCap: 5 },
    );
    return result.notModified
      ? null
      : result.items.map((team) => ({ organization: team.organization.login, slug: team.slug }));
  } catch (error) {
    if (error instanceof GithubApiError && (error.status === 403 || error.status === 404)) {
      return null;
    }
    throw error;
  }
};
