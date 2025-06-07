
import React, { Component, ReactNode } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isNetworkError: boolean;
}

export class NetworkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isNetworkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isNetworkError = 
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network Error') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED') ||
      !navigator.onLine;

    return {
      hasError: true,
      isNetworkError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Network Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-6 text-center">
              <WifiOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">
                {this.state.isNetworkError ? 'Connection Issue' : 'Something went wrong'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {this.state.isNetworkError 
                  ? 'Please check your internet connection and try again.'
                  : 'An unexpected error occurred. Please refresh the page.'
                }
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    this.setState({ hasError: false, isNetworkError: false });
                    window.location.reload();
                  }}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => this.setState({ hasError: false, isNetworkError: false })}
                  className="w-full"
                >
                  Continue Offline
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
