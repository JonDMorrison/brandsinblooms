import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { testNewsletterThemingFix } from '@/scripts/testNewsletterThemingFix';
import { TestTube, CheckCircle, XCircle } from 'lucide-react';

export const NewsletterThemingTestButton: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  const handleTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    
    try {
      const results = await testNewsletterThemingFix();
      setTestResults(results);
      
      if (results.success) {
        toast({
          title: "✅ All Tests Passed!",
          description: "Newsletter theming fix is working correctly.",
        });
      } else {
        toast({
          title: "⚠️ Some Tests Failed",
          description: "Newsletter theming fix needs attention. Check console for details.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "An error occurred during testing. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleTest}
        disabled={isTesting}
        variant="outline"
        className="flex items-center gap-2"
      >
        <TestTube className={`h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
        {isTesting ? 'Testing Newsletter Theming...' : 'Test Newsletter Theming Fix'}
      </Button>
      
      {testResults && (
        <div className="mt-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            {testResults.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <h3 className="font-semibold">
              Test Results: {testResults.success ? 'PASS' : 'FAIL'}
            </h3>
          </div>
          
          <div className="space-y-2">
            {testResults.results.map((result: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                )}
                <div>
                  <span className="font-medium">{result.theme}</span>
                  {result.issues.length > 0 && (
                    <div className="text-muted-foreground">
                      Issues: {result.issues.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">View Full Report</summary>
            <pre className="mt-2 text-xs bg-background p-2 rounded border overflow-auto">
              {testResults.summary}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};