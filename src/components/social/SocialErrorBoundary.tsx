
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SocialErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface SocialErrorBoundaryProps {
  children: React.ReactNode;
}

export class SocialErrorBoundary extends React.Component<SocialErrorBoundaryProps, SocialErrorBoundaryState> {
  constructor(props: SocialErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SocialErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SocialErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold text-red-700 mb-2">Social Media Page Error</h2>
              <p className="text-red-600 mb-6">
                We encountered an issue loading your social media settings. Please try refreshing the page.
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
        </div>
      );
    }

    return this.props.children;
  }
}
