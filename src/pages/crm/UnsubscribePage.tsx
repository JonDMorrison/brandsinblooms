import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const processUnsubscribe = async () => {
      const email = searchParams.get('email');
      const tenantId = searchParams.get('tenant_id');
      const token = searchParams.get('token');

      if (!email || !tenantId || !token) {
        setStatus('error');
        setMessage('Invalid unsubscribe link. Please check the URL and try again.');
        return;
      }

      try {
        // Validate token (simple validation: base64 encoded email:tenant_id)
        const expectedToken = btoa(`${email}:${tenantId}`);
        if (token !== expectedToken) {
          setStatus('error');
          setMessage('Invalid unsubscribe token. This link may have expired.');
          return;
        }

        // Update subscription status
        const { error } = await supabase
          .from('crm_subscriptions')
          .upsert({
            email: email,
            tenant_id: tenantId,
            opt_out: true,
            opt_out_at: new Date().toISOString(),
            source: 'unsubscribe_page'
          }, {
            onConflict: 'email,tenant_id'
          });

        if (error) {
          console.error('Error updating subscription:', error);
          setStatus('error');
          setMessage('Failed to process your unsubscribe request. Please try again.');
        } else {
          setStatus('success');
          setMessage('You have been successfully unsubscribed from our emails.');
        }
      } catch (error) {
        console.error('Error processing unsubscribe:', error);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    processUnsubscribe();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="text-2xl font-bold text-primary mb-2">🌿 BloomSuite</div>
          <h1 className="text-xl font-semibold text-foreground">Email Unsubscribe</h1>
        </div>

        <div className="mb-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing your unsubscribe request...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  You will no longer receive emails from this sender. If you believe this was done in error, 
                  please contact the sender directly.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-foreground">{message}</p>
                <p className="text-sm text-muted-foreground">
                  If you continue to have issues, please contact support for assistance.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            If you have any questions, please contact the sender directly or BloomSuite support.
          </p>
        </div>
      </div>
    </div>
  );
}