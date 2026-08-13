import { Component } from 'react';
import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { errorLogService } from '@/lib/services/ErrorLogService';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
};

/**
 * AppErrorBoundary
 *
 * Wraps the entire app in the root layout. Any unhandled render error is:
 *  1. Logged to the on-device Markdown file via ErrorLogService.
 *  2. Displayed as a recoverable error screen with the log file path shown
 *     so the developer knows exactly where to pull the file from.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    errorLogService.captureRenderError(error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, componentStack: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const logPath = errorLogService.getLogPath();

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <Text style={styles.iconText}>💥</Text>
          </View>

          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            A render error occurred. It has been saved to the log file below.
          </Text>

          {/* Error message */}
          <View style={styles.errorBox}>
            <Text style={styles.errorLabel}>Error</Text>
            <Text style={styles.errorMessage} numberOfLines={4}>
              {this.state.error?.message ?? 'Unknown error'}
            </Text>
          </View>

          {/* Log file path */}
          <View style={styles.pathBox}>
            <Text style={styles.pathLabel}>📄 Log file</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={styles.pathText} selectable>{logPath}</Text>
            </ScrollView>
          </View>

          <Text style={styles.hint}>
            Pull this file from the device to review all grouped errors and warnings.
          </Text>

          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  errorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fca5a5',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 13,
    color: '#fecaca',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  pathBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pathLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pathText: {
    fontSize: 12,
    color: '#10b981',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
});
