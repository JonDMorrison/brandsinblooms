import React from 'react';
import { Button } from '@/components/ui/button';
import { Sentry } from '@/lib/sentry';

export const SentryTestButton: React.FC = () => {
  const testSentryError = () => {
    console.log('🧪 Test Sentry Error button clicked');
    
    // Check if Sentry is properly configured - we'll let the library handle this
    // The DSN is configured in src/lib/sentry.ts
    
    // Test different types of errors
    const errorType = Math.random();
    
    if (errorType < 0.33) {
      // Test manual error capture
      console.log('🔧 Testing manual error capture...');
      Sentry.captureException(new Error('Manual Sentry test error'), {
        tags: {
          test: true,
          errorType: 'manual'
        }
      });
      console.log('✅ Manual error sent to Sentry');
    } else if (errorType < 0.66) {
      // Test thrown error (will be caught by error boundary)
      console.log('🔧 Testing thrown error...');
      throw new Error('Test error thrown by component - Error Boundary should catch this!');
    } else {
      // Test message capture
      console.log('🔧 Testing message capture...');
      Sentry.captureMessage('Test message from Sentry integration', 'info');
      console.log('✅ Test message sent to Sentry');
    }
  };

  return (
    <Button 
      onClick={testSentryError}
      variant="outline"
      className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
    >
      🧪 Test Sentry Error
    </Button>
  );
};