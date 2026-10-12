/**
 * Runs `cleanup` once `promise` settles and passes its value or error through,
 * like `Promise.prototype.finally`.
 *
 * Use this instead of `.finally()`: the Promise implementation at runtime can lack
 * `finally` (see lib/shims/promiseFinally.ts), which throws "undefined is not a function".
 */
export function withCleanup<T>(promise: Promise<T>, cleanup: () => void): Promise<T> {
  return promise.then(
    (value) => {
      cleanup();
      return value;
    },
    (error: unknown) => {
      cleanup();
      throw error;
    },
  );
}
