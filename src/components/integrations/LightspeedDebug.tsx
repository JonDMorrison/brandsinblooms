import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bug, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function LightspeedDebug() {
  const [envResult, setEnvResult] = useState<any>(null);
  const [authResult, setAuthResult] = useState<any>(null);
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [domainPrefix, setDomainPrefix] = useState('brandsinblooms');
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runTest = async (testName: string, functionName: string, params?: Record<string, string>) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: params
      });

      if (error) throw error;

      switch (testName) {
        case 'env':
          setEnvResult(data);
          break;
        case 'auth':
          setAuthResult(data);
          break;
        case 'token':
          setTokenResult(data);
          break;
      }

      toast.success(`${testName} test completed`);
      return data;
    } catch (error: any) {
      toast.error(`${testName} test failed: ${error.message}`);
      console.error(`[${testName}] Error:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const testAuthRedirect = async () => {
    const data = await runTest('auth', 'lightspeed-debug-auth');
    if (data?.auth_url) {
      const popup = window.open(data.auth_url, '_blank', 'width=600,height=800');
      if (!popup) {
        toast.error('Popup blocked. Please allow popups and try again.');
      } else {
        toast.info('Opened Lightspeed consent screen in new window');
      }
    }
  };

  const ResultSection = ({ title, result, icon }: { title: string; result: any; icon: React.ReactNode }) => {
    if (!result) return null;

    return (
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h4 className="font-semibold">{title}</h4>
        </div>
        <pre className="text-xs overflow-auto max-h-64 bg-background p-2 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <Card className="border-warning/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-warning" />
          <CardTitle>Lightspeed OAuth Troubleshooting</CardTitle>
        </div>
        <CardDescription>
          Debug tools to diagnose connection issues. Run these tests in order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test 1: Environment */}
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              Environment Variables
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Verify all required environment variables are set
            </p>
          </div>
          <Button
            onClick={() => runTest('env', 'lightspeed-debug-env')}
            disabled={loading.env}
            variant="outline"
          >
            {loading.env ? 'Checking...' : 'Check Environment'}
          </Button>
          <ResultSection title="Environment Status" result={envResult} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
        </div>

        {/* Test 2: Token Endpoint */}
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              Token Endpoint Test
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Verify domain prefix resolves correctly (expects 400 error)
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="domain">Domain Prefix</Label>
              <Input
                id="domain"
                value={domainPrefix}
                onChange={(e) => setDomainPrefix(e.target.value)}
                placeholder="brandsinblooms"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => runTest('token', 'lightspeed-debug-token', { domain: domainPrefix })}
                disabled={loading.token}
                variant="outline"
              >
                {loading.token ? 'Testing...' : 'Test Endpoint'}
              </Button>
            </div>
          </div>
          <ResultSection title="Token Endpoint Result" result={tokenResult} icon={<AlertCircle className="h-4 w-4 text-warning" />} />
        </div>

        {/* Test 3: Auth Redirect */}
        <div className="border rounded-lg p-4 space-y-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              OAuth Redirect Test
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generate auth URL and test redirect (opens in new window)
            </p>
          </div>
          <Button
            onClick={testAuthRedirect}
            disabled={loading.auth}
            variant="outline"
          >
            {loading.auth ? 'Generating...' : 'Test Auth Redirect'}
          </Button>
          <ResultSection title="Auth URL Details" result={authResult} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
        </div>

        {/* Instructions */}
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">Troubleshooting Checklist</h3>
          <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
            <li>Verify all env vars are present (not "missing")</li>
            <li>Token endpoint should return status 400 (expected)</li>
            <li>Auth redirect should open Lightspeed consent screen</li>
            <li>Ensure you're logged in as an Admin user</li>
            <li>Callback URL must match exactly in Lightspeed Dev Portal</li>
            <li>Check Supabase Edge Function logs for callback details</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
