import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui-legacy/radio-group';
import { Label } from '@/components/ui-legacy/label';
import { Alert, AlertDescription } from '@/components/ui-legacy/alert';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  PartyPopper,
  HeartHandshake
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type PageState = 'loading' | 'invalid' | 'expired' | 'form' | 'success_opted_in' | 'success_opted_out' | 'error';

interface TokenData {
  tenant_id: string;
  customer_id: string;
  email: string;
  purpose: string;
}

interface CompanyInfo {
  name: string;
  address?: string;
}

export default function EmailPreferences() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [state, setState] = useState<PageState>('loading');
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [preference, setPreference] = useState<'subscribe' | 'unsubscribe'>('subscribe');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }

    const validateToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('validate-preference-token', {
          body: { token },
        });

        if (error || !data?.valid) {
          setState(data?.error === 'Token expired' ? 'expired' : 'invalid');
          return;
        }

        setTokenData(data.data);
        setCompanyInfo(data.company || { name: 'Our Company' });
        setState('form');
      } catch (err) {
        console.error('Token validation error:', err);
        setState('error');
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !tokenData) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-email-preference', {
        body: {
          token,
          optIn: preference === 'subscribe',
        },
      });

      if (error || !data?.success) {
        setState('error');
        return;
      }

      setState(preference === 'subscribe' ? 'success_opted_in' : 'success_opted_out');
    } catch (err) {
      console.error('Preference update error:', err);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your preferences...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (state === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This preference link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                If you believe this is an error, please contact the sender of the original email.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired token
  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>
              This preference link has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Please contact us if you would like to update your email preferences.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Something Went Wrong</CardTitle>
            <CardDescription>
              We couldn't update your preferences. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success - Opted In
  if (state === 'success_opted_in') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <PartyPopper className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-green-700">You're Subscribed!</CardTitle>
            <CardDescription>
              You're now subscribed to email updates from {companyInfo?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              You can unsubscribe at any time using the link in our emails.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - Opted Out
  if (state === 'success_opted_out') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <HeartHandshake className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Preferences Updated</CardTitle>
            <CardDescription>
              We've updated your preferences. You won't receive marketing emails from {companyInfo?.name} going forward.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              If you change your mind, you can always re-subscribe through our website.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Email Preferences</CardTitle>
          <CardDescription>
            Manage your email subscription for {tokenData?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={preference} onValueChange={(v) => setPreference(v as 'subscribe' | 'unsubscribe')}>
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="subscribe" id="subscribe" className="mt-1" />
              <Label htmlFor="subscribe" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Yes, I want to receive updates
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Get seasonal tips, promotions, and event updates from {companyInfo?.name}
                </p>
              </Label>
            </div>
            <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="unsubscribe" id="unsubscribe" className="mt-1" />
              <Label htmlFor="unsubscribe" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="h-4 w-4 text-red-500" />
                  No, I don't want marketing emails
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  You won't receive promotional emails, but may still get transactional messages
                </p>
              </Label>
            </div>
          </RadioGroup>

          <Button 
            onClick={handleSubmit} 
            className="w-full" 
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {companyInfo?.name}
            {companyInfo?.address && <><br />{companyInfo.address}</>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
