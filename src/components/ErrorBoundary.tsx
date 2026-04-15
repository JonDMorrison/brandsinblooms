import React from 'react';
import { Card, CardContent } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureException } from '@/utils/uptrace';
import { logReactError } from '@/utils/devErrorLogger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error | null; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Store errorInfo for potential display
    this.setState({ errorInfo });
    
    // Enhanced console logging for development
    console.group('%c🔴 [REACT ERROR BOUNDARY]', 'color: #ff4444; font-weight: bold; font-size: 14px;');
    console.error('%cError:', 'color: #ff6b6b; font-weight: bold;', error.message);
    console.error('%cStack Trace:', 'color: #ffa94d; font-weight: bold;');
    console.error(error.stack);
    console.error('%cComponent Stack:', 'color: #74c0fc; font-weight: bold;');
    console.error(errorInfo.componentStack);
    console.error('%cTimestamp:', 'color: #69db7c; font-weight: bold;', new Date().toISOString());
    console.groupEnd();
    
    // Log to dev error logger for Debug Panel
    logReactError(error, errorInfo.componentStack || undefined, 'ErrorBoundary');
    
    // Send to Uptrace for production monitoring
    captureException(error, { 
      componentStack: errorInfo.componentStack,
      context: 'ErrorBoundary' 
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const Fallback = this.props.fallback;
        return <Fallback error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-red-700 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-6">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={this.resetError}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
