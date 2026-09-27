export type GithubHost = { kind: 'github' } | { kind: 'enterprise'; origin: string };

export const GITHUB_DOT_COM: GithubHost = { kind: 'github' };

export interface HostEndpoints {
  hostKey: string;
  restBaseUrl: string;
  graphqlUrl: string;
  webUrl: string;
}

export const endpointsFor = (host: GithubHost): HostEndpoints => {
  if (host.kind === 'github') {
    return {
      hostKey: 'github.com',
      restBaseUrl: 'https://api.github.com',
      graphqlUrl: 'https://api.github.com/graphql',
      webUrl: 'https://github.com',
    };
  }
  return {
    hostKey: new URL(host.origin).host,
    restBaseUrl: `${host.origin}/api/v3`,
    graphqlUrl: `${host.origin}/api/graphql`,
    webUrl: host.origin,
  };
};

export const parseEnterpriseHost = (input: string): GithubHost | null => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.hostname.includes('*') ||
    !parsed.hostname.includes('.') ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) {
    return null;
  }
  return { kind: 'enterprise', origin: parsed.origin };
};

export const isSameHost = (left: GithubHost, right: GithubHost): boolean =>
  endpointsFor(left).hostKey === endpointsFor(right).hostKey;

export type TokenKind = 'classic' | 'fine-grained';

export const CLASSIC_TOKEN_SCOPES = ['repo', 'read:org'] as const;

export const tokenCreationUrl = (host: GithubHost, kind: TokenKind): string => {
  const { webUrl } = endpointsFor(host);
  if (kind === 'fine-grained') {
    return `${webUrl}/settings/personal-access-tokens/new`;
  }
  const params = new URLSearchParams({
    scopes: CLASSIC_TOKEN_SCOPES.join(','),
    description: 'PR Dashboard extension (read-only)',
  });
  return `${webUrl}/settings/tokens/new?${params.toString()}`;
};

export const pullRequestId = (
  hostKey: string,
  owner: string,
  repo: string,
  number: number,
): string => `${hostKey}:${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;
