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
    console.log(this.formatPrefix('INFO', scope, step), details);
  }

  public success(scope: string, step: string, details: LogDetails = {}): void {
    console.log(this.formatPrefix('SUCCESS', scope, `${step}:success`), details);
  }

  public warn(scope: string, step: string, details: LogDetails = {}): void {
    console.warn(this.formatPrefix('WARN', scope, `${step}:warning`), details);
  }

  public error(scope: string, step: string, error: unknown, details: LogDetails = {}): void {
    // Metro/LogBox can collapse secondary object arguments to only a heading.
    // One serialized message also makes the on-device log export self-contained.
    console.error(`${this.formatPrefix('ERROR', scope, `${step}:error`)} ${this.serialize({ error: this.describeError(error), ...details })}`);
  }

  private serialize(details: LogDetails): string {
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(details, (key: string, value: unknown) => {
        if (/password|authorization|token|secret|caption|body/i.test(key)) return '[redacted]';
        if (typeof value === 'bigint') return String(value);
        if (typeof value === 'string') return value.replace(/(?:https?|file|content):\/\/[^\s"<>]+/gi, '[redacted-uri]');
        if (value && typeof value === 'object') {
          if (seen.has(value)) return '[circular]';
          seen.add(value);
        }
        return value;
      });
    } catch {
      return '{"error":"Unable to serialize diagnostic details"}';
    }
  }

  private formatPrefix(level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR', scope: string, step: string): string {
    return `[${this.prefix}][${new Date().toISOString()}][${level}][${scope}][${step}]`;
  }

  private describeError(error: unknown): { name?: string; message?: string; code?: string | number; stack?: string; value?: string } {
    if (typeof error === 'object' && error !== null) {
      const errorWithCode = error as { name?: unknown; message?: unknown; code?: unknown; stack?: unknown };
      return {
        name: typeof errorWithCode.name === 'string' ? errorWithCode.name : 'Error',
        message: typeof errorWithCode.message === 'string' ? errorWithCode.message : String(error),
        code: typeof errorWithCode.code === 'string' || typeof errorWithCode.code === 'number'
          ? errorWithCode.code
          : undefined,
        stack: typeof errorWithCode.stack === 'string' ? errorWithCode.stack : undefined,
      };
    }
    return { value: String(error) };
  }
}

export const diagnosticLogService = DiagnosticLogService.getInstance();
