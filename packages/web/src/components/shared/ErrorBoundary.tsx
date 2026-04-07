/**
 * 全局错误边界组件
 * 捕获 React 组件树中的错误并显示友好的错误页面
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    // 可以在这里发送错误报告到服务器
    // reportError(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h1>出错了</h1>
            <p className="error-message">
              {this.state.error?.message || '发生了一个未知错误'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="error-details">
                <summary>查看错误详情</summary>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}

            <div className="error-actions">
              <button className="btn-primary" onClick={this.handleRetry}>
                重试
              </button>
              <button className="btn-secondary" onClick={this.handleReload}>
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// 函数式错误边界包装器
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
