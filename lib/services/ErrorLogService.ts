import * as FileSystem from 'expo-file-system/legacy';

type LogLevel = 'error' | 'warn';

type LogEntry = {
  level: LogLevel;
  timestamp: string;
  message: string;
  source: string; // file + function extracted from stack
  stack: string;
};

const LOG_FILENAME = 'ourlime-error-log.md';
const MAX_ENTRIES = 120;
const MAX_MESSAGE_CHARACTERS = 2_000;
const MAX_STACK_CHARACTERS = 8_000;


/**
 * ErrorLogService
 *
 * Intercepts console.error and console.warn globally, extracts the call-site
 * (file + function) from the stack trace, and writes a Markdown log file to
 * the device's document directory so it can be shared / reviewed without
 * reading the terminal.
 *
 * Usage:
 *   ErrorLogService.getInstance().install();   // call once in _layout.tsx
 *   ErrorLogService.getInstance().getLogPath(); // returns the .md file path
 */
export class ErrorLogService {
  private static instance: ErrorLogService;
  private entries: LogEntry[] = [];
  private originalConsoleError: typeof console.error = console.error;
  private originalConsoleWarn: typeof console.warn = console.warn;
  private installed = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): ErrorLogService {
    if (!ErrorLogService.instance) ErrorLogService.instance = new ErrorLogService();
    return ErrorLogService.instance;
  }

  private isCapturing = false;

  /** Patch console.error / console.warn and start capturing. */
  public install(): void {
    if (this.installed) return;
    this.installed = true;

    console.error = (...args: unknown[]) => {
      this.originalConsoleError(...args);
      if (this.isCapturing) return;
      this.isCapturing = true;
      try {
        this.capture('error', args);
      } catch {
        // Safe fallback
      } finally {
        this.isCapturing = false;
      }
    };

    console.warn = (...args: unknown[]) => {
      const message = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a ?? '')))
        .join(' ');
      if (
        message.includes('SafeAreaView has been deprecated') ||
        message.includes('WebChannelConnection') ||
        message.includes('@firebase') ||
        message.includes('transport errored') ||
        message.includes("RPC 'Listen' stream")
      ) {
        return;
      }
      this.originalConsoleWarn(...args);
      if (this.isCapturing) return;
      this.isCapturing = true;
      try {
        this.capture('warn', args);
      } catch {
        // Safe fallback
      } finally {
        this.isCapturing = false;
      }
    };
  }

  /** Capture a render-level error from an ErrorBoundary. */
  public captureRenderError(error: Error, componentStack: string): void {
    const entry: LogEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      message: this.truncate(error.message, MAX_MESSAGE_CHARACTERS),
      source: this.extractSource(error.stack ?? componentStack),
      stack: this.truncate((error.stack ?? '') + '\n\nComponent Stack:\n' + componentStack, MAX_STACK_CHARACTERS),
    };
    this.push(entry);
  }

  /** Absolute path of the markdown log file on-device. */
  public getLogPath(): string {
    try {
      return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${LOG_FILENAME}` : '';
    } catch {
      return '';
    }
  }

  /** Wipe the log file. */
  public async clearLog(): Promise<void> {
    this.entries = [];
    await this.writeFile(this.buildMarkdown([]));
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private capture(level: LogLevel, args: unknown[]): void {
    const message = args
      .map((a) => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === 'object' && a !== null) {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a ?? '');
      })
      .join(' ');

    if (
      !message ||
      message.includes('@firebase') ||
      message.includes('WebChannelConnection') ||
      message.includes('transport errored') ||
      message.includes('RPC') ||
      message.includes('SafeAreaView has been deprecated')
    ) {
      return;
    }

    // Build a synthetic stack from the current execution context.
    const syntheticError = new Error(message);
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message: this.truncate(message, MAX_MESSAGE_CHARACTERS),
      source: this.extractSource(syntheticError.stack ?? ''),
      stack: this.truncate(syntheticError.stack ?? '', MAX_STACK_CHARACTERS),
    };
    this.push(entry);
  }

  private push(entry: LogEntry): void {
    this.entries.push(entry);
    // Keep the rolling window under MAX_ENTRIES.
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    this.scheduleFlush();
  }

  /** Debounce disk writes so rapid bursts of errors don't hammer the FS. */
  private scheduleFlush(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 800);
  }

  private async flush(): Promise<void> {
    try {
      await this.writeFile(this.buildMarkdown(this.entries));
    } catch {
      // Never let logging crash the app.
    }
  }

  private async writeFile(content: string): Promise<void> {
    try {
      const path = this.getLogPath();
      if (!path) return;
      await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    } catch {
      // Silent error protection
    }
  }

  /**
   * Parse the call stack and return `FunctionName  (file.tsx:line)` for the
   * first frame that isn't inside node_modules or this service itself.
   */
  private extractSource(stack: string): string {
    const lines = stack.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('at ')) continue;
      if (trimmed.includes('node_modules')) continue;
      if (trimmed.includes('ErrorLogService')) continue;
      if (trimmed.includes('console.error') || trimmed.includes('console.warn')) continue;
      // "at FunctionName (path/to/File.tsx:42:10)"  or  "at path/to/File.tsx:42:10"
      return trimmed.replace(/^at\s+/, '');
    }
    return 'unknown';
  }

  private truncate(value: string, maximumCharacters: number): string {
    if (value.length <= maximumCharacters) return value;
    return `${value.slice(0, maximumCharacters)}\n...[truncated]`;
  }

  private buildMarkdown(entries: LogEntry[]): string {
    const header = [
      '# Ourlime Mobile — Runtime Error Log',
      '',
      `> Generated: ${new Date().toISOString()}`,
      `> Total entries: ${entries.length} (max ${MAX_ENTRIES})`,
      '',
      '---',
      '',
    ].join('\n');

    if (entries.length === 0) return header + '_No errors or warnings captured yet._\n';

    // Group by source file for easier scanning.
    const grouped = new Map<string, LogEntry[]>();
    for (const entry of entries) {
      const key = entry.source;
      const bucket = grouped.get(key) ?? [];
      bucket.push(entry);
      grouped.set(key, bucket);
    }

    const sections: string[] = [];
    for (const [source, group] of grouped) {
      sections.push(`## ${source}`);
      sections.push('');
      for (const e of group) {
        const badge = e.level === 'error' ? '🔴 ERROR' : '🟡 WARN';
        sections.push(`### ${badge} — ${e.timestamp}`);
        sections.push('');
        sections.push('**Message:**');
        sections.push('```');
        sections.push(e.message);
        sections.push('```');
        sections.push('');
        if (e.stack) {
          sections.push('<details><summary>Stack trace</summary>');
          sections.push('');
          sections.push('```');
          sections.push(e.stack);
          sections.push('```');
          sections.push('</details>');
          sections.push('');
        }
      }
      sections.push('---');
      sections.push('');
    }

    return header + sections.join('\n');
  }
}

export const errorLogService = ErrorLogService.getInstance();
