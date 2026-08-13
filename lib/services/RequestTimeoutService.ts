export class RequestTimeoutError extends Error {
  public constructor(operationName: string, timeoutMs: number) {
    super(operationName + ' did not respond within ' + Math.ceil(timeoutMs / 1000) + ' seconds.');
    this.name = 'RequestTimeoutError';
  }
}

export class RequestTimeoutService {
  private static instance: RequestTimeoutService;

  private constructor() {}

  public static getInstance(): RequestTimeoutService {
    if (!RequestTimeoutService.instance) RequestTimeoutService.instance = new RequestTimeoutService();
    return RequestTimeoutService.instance;
  }

  public run<TData>(operation: Promise<TData>, operationName: string, timeoutMs = 12_000): Promise<TData> {
    return new Promise<TData>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new RequestTimeoutError(operationName, timeoutMs)), timeoutMs);
      operation.then(
        (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }
}

export const requestTimeoutService = RequestTimeoutService.getInstance();
