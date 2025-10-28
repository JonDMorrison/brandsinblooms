import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Copy, RefreshCw, CheckCircle } from 'lucide-react';

export default function LightspeedDebugPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lightspeed-diagnostics');
      
      if (error) {
        toast({ 
          title: 'Diagnostics failed', 
          description: error.message, 
          variant: 'destructive' 
        });
        setDiagnostics({ error: error.message });
      } else {
        setDiagnostics(data);
        toast({ title: 'Diagnostics completed' });
      }
    } catch (error: any) {
      toast({ 
        title: 'Diagnostics failed', 
        description: error.message, 
        variant: 'destructive' 
      });
      setDiagnostics({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (diagnostics) {
      navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      toast({ title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Lightspeed Diagnostics</h1>
        <p className="text-muted-foreground">
          Comprehensive health check and debugging information for your Lightspeed integration
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button onClick={runDiagnostics} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Running diagnostics...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Diagnostics
            </>
          )}
        </Button>
        {diagnostics && (
          <Button onClick={copyToClipboard} variant="outline">
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Results
              </>
            )}
          </Button>
        )}
      </div>

      {diagnostics && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span className={getStatusColor(diagnostics.success)}>
                  {diagnostics.success ? '✓ All checks passed' : '✗ Issues detected'}
                </span>
              </div>
              <div>
                <span className="font-medium">Timestamp:</span>{' '}
                <span className="text-muted-foreground">{diagnostics.timestamp}</span>
              </div>
              {diagnostics.errors?.length > 0 && (
                <div>
                  <span className="font-medium text-red-600">Errors:</span>
                  <ul className="list-disc list-inside ml-4 text-red-600">
                    {diagnostics.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          {/* Connection Status */}
          {diagnostics.connection && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Status:</span>
                  <span className={getStatusColor(diagnostics.connection.status === 'connected')}>
                    {diagnostics.connection.status}
                  </span>
                  {diagnostics.connection.domain_prefix && (
                    <>
                      <span className="font-medium">Domain:</span>
                      <span>{diagnostics.connection.domain_prefix}.retail.lightspeed.app</span>
                    </>
                  )}
                  {diagnostics.connection.retailer_name && (
                    <>
                      <span className="font-medium">Retailer:</span>
                      <span>{diagnostics.connection.retailer_name}</span>
                    </>
                  )}
                  {diagnostics.connection.minutes_until_expiry !== undefined && (
                    <>
                      <span className="font-medium">Token Expiry:</span>
                      <span className={getStatusColor(diagnostics.connection.token_valid)}>
                        {diagnostics.connection.minutes_until_expiry > 0
                          ? `${Math.floor(diagnostics.connection.minutes_until_expiry / 60)}h ${diagnostics.connection.minutes_until_expiry % 60}m remaining`
                          : 'Expired'}
                      </span>
                    </>
                  )}
                  {diagnostics.connection.last_synced_at && (
                    <>
                      <span className="font-medium">Last Synced:</span>
                      <span>{new Date(diagnostics.connection.last_synced_at).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* API Tests */}
          {diagnostics.apiTests && Object.keys(diagnostics.apiTests).length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">API Tests</h2>
              <div className="space-y-4">
                {Object.entries(diagnostics.apiTests).map(([endpoint, result]: [string, any]) => (
                  <div key={endpoint} className="border-l-2 pl-4 border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium capitalize">{endpoint}</span>
                      <span className={getStatusColor(result.success)}>
                        {result.success ? '✓' : '✗'}
                      </span>
                      {result.status && (
                        <span className="text-xs text-muted-foreground">
                          HTTP {result.status}
                        </span>
                      )}
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-600">{result.error}</p>
                    )}
                    {result.count !== undefined && (
                      <p className="text-sm text-muted-foreground">Found {result.count} items</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sync Statistics */}
          {diagnostics.syncStats && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Sync Statistics</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary">
                    {diagnostics.syncStats.customers}
                  </div>
                  <div className="text-sm text-muted-foreground">Customers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {diagnostics.syncStats.sales}
                  </div>
                  <div className="text-sm text-muted-foreground">Sales</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-600">
                    {diagnostics.syncStats.products}
                  </div>
                  <div className="text-sm text-muted-foreground">Products</div>
                </div>
              </div>
            </Card>
          )}

          {/* Raw JSON */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Raw JSON Output</h2>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs max-h-96">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          </Card>
        </div>
      )}

      {!diagnostics && !isLoading && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            Click "Run Diagnostics" to start a comprehensive health check
          </p>
          <p className="text-sm text-muted-foreground">
            This will test your connection, API access, token validity, and sync statistics
          </p>
        </Card>
      )}
    </div>
  );
}
