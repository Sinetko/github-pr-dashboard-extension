import { GithubGraphqlError, GithubRateLimitError } from './errors';
import { githubFetch } from './github-fetch';

interface GraphqlErrorEntry {
  type?: string;
  message: string;
  path?: (string | number)[];
}

interface GraphqlEnvelope<TData> {
  data?: TData | null;
  errors?: GraphqlErrorEntry[];
}

export interface GraphqlResult<TData> {
  data: TData;
  partialErrors: string[];
}

const ONE_HOUR_MILLISECONDS = 3_600_000;

export const githubGraphql = async <TData>(
  graphqlUrl: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphqlResult<TData>> => {
  const response = await githubFetch<GraphqlEnvelope<TData>>(graphqlUrl, token, graphqlUrl, {
    method: 'POST',
    body: { query, variables },
    accept: 'application/json',
  });
  if (response.notModified) {
    throw new GithubGraphqlError(['Unexpected 304 for a GraphQL request']);
  }
  const errors = response.data.errors ?? [];
  if (errors.some((error) => error.type === 'RATE_LIMITED')) {
    throw new GithubRateLimitError(
      response.rateLimit?.resetAt ?? new Date(Date.now() + ONE_HOUR_MILLISECONDS),
    );
  }
  const { data } = response.data;
  if (data === undefined || data === null) {
    throw new GithubGraphqlError(errors.map((error) => error.message));
  }
  return { data, partialErrors: errors.map((error) => error.message) };
};
