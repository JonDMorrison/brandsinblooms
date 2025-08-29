import React from 'react';
import { Button } from '@/components/ui/button';
import { Sentry } from '@/lib/sentry';

export const SentryTestButton: React.FC = () => {
  const testSentryError = () => {
    console.log('🧪 Test Sentry Error button clicked');
    
    // Check current Sentry configuration
    const dsn = ""; // This should match what's in src/lib/sentry.ts
    if (!dsn) {
      console.warn('⚠️  Sentry DSN not configured in src/lib/sentry.ts');
      console.log('📋 To enable Sentry:');
      console.log('1. Go to https://sentry.io and create/login to your account');
      console.log('2. Create a new React project or use existing one');
      console.log('3. Copy your DSN from Project Settings > Client Keys (DSN)');
      console.log('4. In src/lib/sentry.ts, replace the empty dsn = "" with your actual DSN');
      console.log('5. Test again - errors will then appear in your Sentry dashboard');
    }
    
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
      console.log('✅ Manual error sent to Sentry (if DSN configured)');
    } else if (errorType < 0.66) {
      // Test thrown error (will be caught by error boundary)
      console.log('🔧 Testing thrown error...');
      throw new Error('Test error thrown by component - Error Boundary should catch this!');
    } else {
      // Test message capture
      console.log('🔧 Testing message capture...');
      Sentry.captureMessage('Test message from Sentry integration', 'info');
      console.log('✅ Test message sent to Sentry (if DSN configured)');
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