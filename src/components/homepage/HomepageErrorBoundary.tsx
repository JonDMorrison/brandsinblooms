
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface HomepageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface HomepageErrorBoundaryProps {
  children: React.ReactNode;
}

export class HomepageErrorBoundary extends React.Component<HomepageErrorBoundaryProps, HomepageErrorBoundaryState> {
  constructor(props: HomepageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): HomepageErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Homepage Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
      hasError: true
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-garden-background p-6">
          <div className="max-w-2xl mx-auto">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-semibold text-red-700 mb-2">Dashboard Error</h2>
                <p className="text-red-600 mb-6">
                  We encountered an issue loading your dashboard. This might be due to a temporary problem.
                </p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mb-6 p-4 bg-red-100 rounded text-left text-sm text-red-800">
                    <strong>Error:</strong> {this.state.error.message}
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary>Error Details</summary>
                        <pre className="whitespace-pre-wrap text-xs mt-2">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                
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
                    <Home className="w-4 h-4 mr-2" />
                    Reload Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
