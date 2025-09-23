import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContentLibraryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ContentLibraryErrorBoundaryProps {
  children: React.ReactNode;
}

export class ContentLibraryErrorBoundary extends React.Component<
  ContentLibraryErrorBoundaryProps,
  ContentLibraryErrorBoundaryState
> {
  constructor(props: ContentLibraryErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ContentLibraryErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Content Library Error Boundary caught an error:', error, errorInfo);
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
          <div className="max-w-2xl mx-auto">
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
                <h2 className="text-xl font-semibold text-destructive mb-2">Content Library Error</h2>
                <p className="text-destructive/80 mb-6">
                  We encountered an issue loading your content library. This might be a temporary problem.
                </p>
                
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="mb-6 p-4 bg-destructive/10 rounded text-left text-sm text-destructive border border-destructive/20">
                    <strong>Error:</strong> {this.state.error.message}
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">Error Details</summary>
                        <pre className="whitespace-pre-wrap text-xs mt-2 max-h-40 overflow-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={this.resetError}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => window.history.back()}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
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