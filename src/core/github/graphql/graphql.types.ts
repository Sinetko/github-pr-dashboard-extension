export type GraphqlPullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';
export type GraphqlMergeable = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
export type GraphqlMergeStateStatus =
  'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE';
export type GraphqlReviewState =
  'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
export type GraphqlStatusState = 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS';

interface GraphqlActor {
  login: string;
}

export interface GraphqlReview {
  state: GraphqlReviewState;
  submittedAt: string | null;
  author: GraphqlActor | null;
  commit: { oid: string } | null;
}

export type GraphqlRequestedReviewer =
  | { __typename: 'User'; login: string }
  | { __typename: 'Team'; slug: string; organization: { login: string } }
  | { __typename: 'Bot' | 'Mannequin' };

export interface GraphqlPullRequest {
  __typename: 'PullRequest';
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  state: GraphqlPullRequestState;
  createdAt: string;
  updatedAt: string;
  baseRefName: string;
  headRefOid: string;
  mergeable: GraphqlMergeable;
  mergeStateStatus: GraphqlMergeStateStatus;
  author: (GraphqlActor & { avatarUrl: string }) | null;
  repository: { name: string; owner: GraphqlActor };
  labels: { nodes: ({ name: string; color: string; description: string | null } | null)[] } | null;
  reviewRequests: {
    nodes: ({ requestedReviewer: GraphqlRequestedReviewer | null } | null)[];
  } | null;
  latestOpinionatedReviews: { nodes: (GraphqlReview | null)[] } | null;
  reviews: { totalCount: number; nodes: (GraphqlReview | null)[] } | null;
  comments: {
    totalCount: number;
    nodes: ({ createdAt: string; author: GraphqlActor | null } | null)[];
  };
  commits: {
    nodes: ({
      commit: { committedDate: string; statusCheckRollup: { state: GraphqlStatusState } | null };
    } | null)[];
  };
  reviewThreads: { totalCount: number; nodes: ({ isResolved: boolean } | null)[] };
}

export type GraphqlNode = GraphqlPullRequest | { __typename: string } | null;

export interface PullRequestsByIdData {
  nodes: GraphqlNode[];
}

export interface SearchPullRequestsData {
  search: {
    issueCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: GraphqlNode[];
  };
}

export const isGraphqlPullRequest = (node: GraphqlNode): node is GraphqlPullRequest =>
  node !== null && node.__typename === 'PullRequest';
