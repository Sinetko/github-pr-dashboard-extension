export type SettledResult<TResult> =
  { status: 'fulfilled'; value: TResult } | { status: 'rejected'; reason: unknown };

export const mapWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
): Promise<SettledResult<TResult>[]> => {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`concurrency must be a positive integer, got ${concurrency}`);
  }
  const results = new Array<SettledResult<TResult>>(items.length);
  let nextIndex = 0;
  const runWorker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index] as TItem;
      try {
        results[index] = { status: 'fulfilled', value: await worker(item, index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
};
