export const countUnresolvedReviewThreads = (
  threads: readonly ({ isResolved: boolean } | null)[],
): number => threads.filter((thread) => thread !== null && !thread.isResolved).length;
