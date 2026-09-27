export type ChecksStatus = 'pending' | 'success' | 'failure' | 'neutral';
export type Mergeability = 'mergeable' | 'conflicting' | 'unknown';
export type MergeState = 'clean' | 'dirty' | 'blocked' | 'behind' | 'unstable' | 'unknown';
export type PullRequestState = 'open' | 'closed' | 'merged';
export type ReviewState = 'approved' | 'changes-requested' | 'commented' | 'dismissed';

export type ReviewRequest =
  { kind: 'user'; login: string } | { kind: 'team'; organization: string; slug: string };

export interface Actor {
  login: string;
  avatarUrl: string;
}

export interface Label {
  name: string;
  color: string;
  description: string | null;
}

export interface Review {
  login: string;
  state: ReviewState;
  submittedAt: string;
  commitOid: string | null;
}

export interface RepositoryRef {
  owner: string;
  name: string;
}

export interface PullRequest {
  id: string;
  nodeId: string;
  repository: RepositoryRef;
  number: number;
  title: string;
  htmlUrl: string;
  author: Actor | null;
  state: PullRequestState;
  isDraftNative: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  headRefOid: string;
  baseRefName: string;
  labels: Label[];
  requestedReviewers: ReviewRequest[];
  latestReviews: Review[];
  lastReview: Review | null;
  lastComment: { login: string | null; createdAt: string } | null;
  requiredApprovals: number | null;
  checks: ChecksStatus;
  mergeability: Mergeability;
  mergeState: MergeState;
  commentCount: number;
  reviewCount: number;
  unresolvedThreadCount: number;
}

export interface Viewer {
  login: string;
  name: string | null;
  avatarUrl: string;
  scopes: string[] | null;
}

export interface TeamRef {
  organization: string;
  slug: string;
}

export interface PullRequestFlags {
  isDraft: boolean;
  isStale: boolean;
  isUntouched: boolean;
  hasConflicts: boolean;
  checksFailed: boolean;
  needsReview: boolean;
  needsMyReview: boolean;
  isMine: boolean;
  approvals: { approved: number; required: number | null };
}

export interface FlagContext {
  viewerLogin: string;
  viewerTeams: readonly TeamRef[] | null;
  staleThresholdDays: number;
  now: Date;
}
