export class GithubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class GithubApiError extends GithubError {
  constructor(
    readonly status: number,
    readonly bodySnippet: string,
    readonly requestLabel: string,
  ) {
    super(`GitHub API ${status} for ${requestLabel}`);
  }
}

export class GithubUnauthorizedError extends GithubApiError {}

export class GithubRateLimitError extends GithubError {
  constructor(readonly resetAt: Date) {
    super(`GitHub rate limit exhausted until ${resetAt.toISOString()}`);
  }
}

export class GithubSecondaryRateLimitError extends GithubError {
  constructor(readonly retryAfterSeconds: number) {
    super(`GitHub secondary rate limit; retry after ${retryAfterSeconds}s`);
  }
}

export class GithubTimeoutError extends GithubError {
  constructor(
    readonly timeoutMilliseconds: number,
    readonly requestLabel: string,
  ) {
    super(`GitHub request timed out after ${timeoutMilliseconds}ms: ${requestLabel}`);
  }
}

export class GithubNetworkError extends GithubError {
  constructor(readonly requestLabel: string) {
    super(`Network error contacting GitHub: ${requestLabel}`);
  }
}

export class GithubGraphqlError extends GithubError {
  constructor(readonly errorMessages: readonly string[]) {
    super(`GitHub GraphQL error: ${errorMessages.join('; ').slice(0, 200)}`);
  }
}
