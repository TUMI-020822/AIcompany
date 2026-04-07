import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary, #0d1117)',
          color: 'var(--text-primary, #e6edf3)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 48,
            marginBottom: 16,
          }}>
            ⚠️
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600 }}>
            页面出现了意外错误
          </h2>
          <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary, #8b949e)', fontSize: 14, maxWidth: 480 }}>
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <p style={{ margin: '0 0 24px 0', color: 'var(--text-tertiary, #6e7681)', fontSize: 13 }}>
            请尝试重新加载或返回首页
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid var(--border, #30363d)',
                background: 'transparent',
                color: 'var(--text-primary, #e6edf3)',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              重新加载
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent, #3370ff)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
