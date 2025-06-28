
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';

interface PublishErrorHandlerProps {
  error: string;
  onRetry?: () => void;
  onReconnect?: () => void;
}

export const PublishErrorHandler = ({ error, onRetry, onReconnect }: PublishErrorHandlerProps) => {
  const isConnectionError = error.toLowerCase().includes('connection') || 
                           error.toLowerCase().includes('token') ||
                           error.toLowerCase().includes('permission');

  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">
        <div className="space-y-3">
          <p><strong>Publishing failed:</strong> {error}</p>
          
          <div className="flex gap-2">
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
            
            {isConnectionError && onReconnect && (
              <Button variant="outline" size="sm" onClick={onReconnect}>
                <Settings className="w-3 h-3 mr-1" />
                Reconnect Account
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
