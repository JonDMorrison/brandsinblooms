
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { DashboardError } from './DashboardError';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    // Force a re-render of the dashboard
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return <DashboardError onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
