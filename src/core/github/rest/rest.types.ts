export interface RestUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface RestPullRequestListItem {
  number: number;
  node_id: string;
  state: 'open' | 'closed';
  draft?: boolean;
  title: string;
  updated_at: string;
}

export interface RestTeam {
  slug: string;
  organization: { login: string };
}

export interface RestBranchRule {
  type: string;
  parameters?: { required_approving_review_count?: number };
}

export interface RestRequiredPullRequestReviews {
  required_approving_review_count?: number;
}

export interface RestCheckRun {
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | 'startup_failure'
    | null;
}

export interface RestCommitStatus {
  state: 'error' | 'failure' | 'pending' | 'success';
}
