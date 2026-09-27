import type { Mergeability, MergeState, PullRequest } from '../domain/pull-request.types';
import type { GraphqlMergeable, GraphqlMergeStateStatus } from '../graphql/graphql.types';

export const toMergeability = (mergeable: GraphqlMergeable): Mergeability => {
  switch (mergeable) {
    case 'MERGEABLE':
      return 'mergeable';
    case 'CONFLICTING':
      return 'conflicting';
    case 'UNKNOWN':
      return 'unknown';
  }
};

export const toMergeState = (status: GraphqlMergeStateStatus): MergeState => {
  switch (status) {
    case 'CLEAN':
    case 'HAS_HOOKS':
      return 'clean';
    case 'DIRTY':
      return 'dirty';
    case 'BLOCKED':
    case 'DRAFT':
      return 'blocked';
    case 'BEHIND':
      return 'behind';
    case 'UNSTABLE':
      return 'unstable';
    case 'UNKNOWN':
      return 'unknown';
  }
};

export const hasMergeConflicts = (
  pullRequest: Pick<PullRequest, 'mergeability' | 'mergeState'>,
): boolean => pullRequest.mergeability === 'conflicting' || pullRequest.mergeState === 'dirty';

export const isMergeabilityPending = (
  pullRequest: Pick<PullRequest, 'mergeability' | 'mergeState' | 'state'>,
): boolean =>
  pullRequest.state === 'open' &&
  (pullRequest.mergeability === 'unknown' || pullRequest.mergeState === 'unknown');
