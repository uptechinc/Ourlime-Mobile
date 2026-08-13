type LogDetails = Record<string, unknown>;

export class DiagnosticLogService {
  private static instance: DiagnosticLogService;
  private readonly prefix = 'Ourlime.Mobile';

  private constructor() {}

  public static getInstance(): DiagnosticLogService {
    if (!DiagnosticLogService.instance) {
      DiagnosticLogService.instance = new DiagnosticLogService();
    }
    return DiagnosticLogService.instance;
  }

  public info(scope: string, step: string, details: LogDetails = {}): void {
    console.log(this.formatPrefix(scope, step), details);
  }

  public success(scope: string, step: string, details: LogDetails = {}): void {
    console.log(this.formatPrefix(scope, `${step}:success`), details);
  }

  public warn(scope: string, step: string, details: LogDetails = {}): void {
    console.log(this.formatPrefix(scope, `${step}:warning`), details);
  }

  public error(scope: string, step: string, error: unknown, details: LogDetails = {}): void {
    console.log(this.formatPrefix(scope, `${step}:error`), {
      ...details,
      error: this.describeError(error),
    });
  }

  private formatPrefix(scope: string, step: string): string {
    return `[${this.prefix}][${new Date().toISOString()}][${scope}][${step}]`;
  }

  private describeError(error: unknown): LogDetails {
    if (error instanceof Error) {
      const errorWithCode = error as Error & { code?: unknown };
      return {
        name: error.name,
        message: error.message,
        code: typeof errorWithCode.code === 'string' || typeof errorWithCode.code === 'number'
          ? errorWithCode.code
          : undefined,
        stack: error.stack,
      };
    }
    return { value: String(error) };
  }
}

export const diagnosticLogService = DiagnosticLogService.getInstance();
