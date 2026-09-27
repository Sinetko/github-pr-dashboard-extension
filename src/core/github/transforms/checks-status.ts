import type { ChecksStatus } from '../domain/pull-request.types';
import type { GraphqlStatusState } from '../graphql/graphql.types';
import type { RestCheckRun, RestCommitStatus } from '../rest/rest.types';

export const checksStatusFromRollup = (
  state: GraphqlStatusState | null | undefined,
): ChecksStatus => {
  switch (state) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
    case 'ERROR':
      return 'failure';
    case 'PENDING':
    case 'EXPECTED':
      return 'pending';
    case null:
    case undefined:
      return 'neutral';
  }
};

const FAILING_CONCLUSIONS = new Set<RestCheckRun['conclusion']>([
  'failure',
  'timed_out',
  'cancelled',
  'action_required',
  'startup_failure',
]);

export const reduceRestChecks = (
  checkRuns: readonly RestCheckRun[],
  statuses: readonly RestCommitStatus[],
): ChecksStatus => {
  const hasFailure =
    checkRuns.some(
      (run) => run.status === 'completed' && FAILING_CONCLUSIONS.has(run.conclusion),
    ) || statuses.some((status) => status.state === 'failure' || status.state === 'error');
  if (hasFailure) {
    return 'failure';
  }
  const hasPending =
    checkRuns.some((run) => run.status !== 'completed') ||
    statuses.some((status) => status.state === 'pending');
  if (hasPending) {
    return 'pending';
  }
  const hasSuccess =
    checkRuns.some((run) => run.conclusion === 'success') ||
    statuses.some((status) => status.state === 'success');
  return hasSuccess ? 'success' : 'neutral';
};
