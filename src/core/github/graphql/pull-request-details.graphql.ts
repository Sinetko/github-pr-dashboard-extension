export const PULL_REQUEST_DETAILS_FRAGMENT = `
  fragment PullRequestDetails on PullRequest {
    id
    number
    title
    url
    isDraft
    state
    createdAt
    updatedAt
    baseRefName
    headRefOid
    mergeable
    mergeStateStatus
    author {
      login
      avatarUrl
    }
    repository {
      name
      owner {
        login
      }
    }
    labels(first: 20) {
      nodes {
        name
        color
        description
      }
    }
    reviewRequests(first: 20) {
      nodes {
        requestedReviewer {
          __typename
          ... on User {
            login
          }
          ... on Team {
            slug
            organization {
              login
            }
          }
        }
      }
    }
    latestOpinionatedReviews(first: 50) {
      nodes {
        state
        submittedAt
        author {
          login
        }
        commit {
          oid
        }
      }
    }
    reviews(last: 1) {
      totalCount
      nodes {
        state
        submittedAt
        author {
          login
        }
        commit {
          oid
        }
      }
    }
    comments(last: 1) {
      totalCount
      nodes {
        createdAt
        author {
          login
        }
      }
    }
    commits(last: 1) {
      nodes {
        commit {
          committedDate
          statusCheckRollup {
            state
          }
        }
      }
    }
    reviewThreads(first: 100) {
      totalCount
      nodes {
        isResolved
      }
    }
  }
`;

export const PULL_REQUESTS_BY_ID_QUERY = `
  query PullRequestsById($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ...PullRequestDetails
    }
  }
  ${PULL_REQUEST_DETAILS_FRAGMENT}
`;

export const SEARCH_PULL_REQUESTS_QUERY = `
  query SearchPullRequests($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        ...PullRequestDetails
      }
    }
  }
  ${PULL_REQUEST_DETAILS_FRAGMENT}
`;

export const NODE_BATCH_SIZE = 25;
export const SEARCH_PAGE_SIZE = 25;
