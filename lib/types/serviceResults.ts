export type PageResult<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ServiceErrorCode =
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'validation'
  | 'missing-index'
  | 'not-found'
  | 'unknown';

export class ServiceResultError extends Error {
  public constructor(public readonly code: ServiceErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ServiceResultError';
  }
}

export type LoadableResult<TData> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'success'; data: TData; error: null }
  | { status: 'error'; data: null; error: ServiceResultError };
