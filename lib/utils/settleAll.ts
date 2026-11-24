type SettledTuple<T extends readonly unknown[]> = { -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> };

/**
 * Promise.allSettled for React Native: the app's Promise implementation has no allSettled, so calling it throws
 * "undefined is not a function". Same result shape, so it is a drop-in replacement (tuples keep each item's type).
 */
export function settleAll<T extends readonly unknown[] | []>(promises: T): Promise<SettledTuple<T>>;
export function settleAll(promises: readonly unknown[]): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.all(promises.map((promise) => Promise.resolve(promise).then(
    (value): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value }),
    (reason: unknown): PromiseSettledResult<unknown> => ({ status: 'rejected', reason }),
  )));
}
