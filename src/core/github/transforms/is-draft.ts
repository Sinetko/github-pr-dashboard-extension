import type { PullRequest } from '../domain/pull-request.types';

export const DRAFT_TITLE_PATTERN = /^\s*(draft|wip)\s*:/i;

export const isDraft = (pullRequest: Pick<PullRequest, 'isDraftNative' | 'title'>): boolean =>
  pullRequest.isDraftNative || DRAFT_TITLE_PATTERN.test(pullRequest.title);
