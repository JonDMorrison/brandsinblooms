import { useState } from 'react';
import { Button } from '@/components/ui-legacy/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, CheckCircle } from 'lucide-react';

export default function SeedDemoCustomers() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSeedCustomers = async () => {
    setIsSeeding(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-customers', {
        body: {
          userId: '4d993313-c925-4c96-a8ee-3ab5be5c54cf',
          count: 500
        }
      });

      if (error) throw error;

      setResult(data);
      toast.success(`Successfully created ${data.customersCreated} demo customers!`);
    } catch (error) {
      console.error('Seeding error:', error);
      toast.error('Failed to seed customers: ' + error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Seed Demo Customers for Plant Addicts</CardTitle>
          <CardDescription>
            This will create 500 diverse demo customers for richard.anderson@plantaddicts.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">What this will do:</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Create "Plant Addicts" tenant (if not exists)</li>
              <li>Assign richard.anderson@plantaddicts.com to the tenant</li>
              <li>Create 8 garden center personas</li>
              <li>Generate 500 diverse demo customers with:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li>Diverse names (American, Hispanic, Asian, African, Middle Eastern, European)</li>
                  <li>Realistic email addresses and phone numbers</li>
                  <li>Random persona assignments</li>
                  <li>Varied purchase history and financial data</li>
                  <li>Mixed opt-in statuses (email/SMS)</li>
                  <li>Geographic timezone diversity</li>
                  <li>Historical creation and purchase dates</li>
                </ul>
              </li>
            </ul>
          </div>

          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle className="h-5 w-5" />
                Seeding Complete!
              </div>
              <div className="text-sm space-y-1">
                <p>Tenant ID: <code className="bg-green-100 px-2 py-1 rounded">{result.tenantId}</code></p>
                <p>Personas Created: {result.personasCreated}</p>
                <p>Customers Created: {result.customersCreated}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSeedCustomers}
            disabled={isSeeding}
            className="w-full"
            size="lg"
          >
            {isSeeding ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Seeding Customers... This may take 1-2 minutes
              </>
            ) : (
              <>
                <Users className="mr-2 h-5 w-5" />
                Seed 500 Demo Customers
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
