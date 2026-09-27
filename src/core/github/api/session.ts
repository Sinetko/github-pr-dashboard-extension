import type { GithubHost } from '../domain/host';

export interface GithubSession {
  host: GithubHost;
  getToken: () => Promise<string>;
}

export interface RepositorySource {
  owner: string;
  name: string;
}

const REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

export const parseRepositorySource = (input: string): RepositorySource | null => {
  const trimmed = input
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '');
  const [owner, name, ...rest] = trimmed.split('/');
  if (
    owner === undefined ||
    name === undefined ||
    rest.length > 0 ||
    !REPOSITORY_SEGMENT.test(owner) ||
    !REPOSITORY_SEGMENT.test(name) ||
    name === '.' ||
    name === '..'
  ) {
    return null;
  }
  return { owner, name };
};

export const repositoryPath = ({ owner, name }: RepositorySource): string =>
  `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
