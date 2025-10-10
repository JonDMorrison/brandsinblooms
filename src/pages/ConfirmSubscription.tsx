import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConfirmSubscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmSubscription = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('Invalid confirmation link. Please check your email and try again.');
          return;
        }

        // Decode the customer ID from the token
        const customerId = atob(token);

        // Update customer consent
        const { error } = await supabase
          .from('crm_customers')
          .update({
            email_opt_in: true,
            email_opt_in_at: new Date().toISOString(),
            email_consent_method: 'double_opt_in',
            email_consent_source: 'confirmed_email',
          })
          .eq('id', customerId);

        if (error) {
          console.error('Confirmation error:', error);
          setStatus('error');
          setMessage('Failed to confirm subscription. The link may have expired.');
          return;
        }

        setStatus('success');
        setMessage('Your subscription has been confirmed! You\'ll now receive our updates and offers.');
        
      } catch (error) {
        console.error('Confirmation error:', error);
        setStatus('error');
        setMessage('Something went wrong. Please try again later.');
      }
    };

    confirmSubscription();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Confirming Subscription...</h1>
            <p className="text-muted-foreground">Please wait while we confirm your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h1 className="text-2xl font-bold mb-2 text-green-600">Success!</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Continue
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-2xl font-bold mb-2 text-destructive">Confirmation Failed</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
