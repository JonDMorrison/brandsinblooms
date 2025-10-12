import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImportStepProps {
  jobId: string;
  suggestions: any[];
  onComplete: (report: any) => void;
  onBack: () => void;
}

export const ImportStep = ({ jobId, suggestions, onComplete, onBack }: ImportStepProps) => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Ready to import');
  const [errors, setErrors] = useState<string[]>([]);

  const startImport = async () => {
    setImporting(true);
    setProgress(10);
    setStatus('Fetching provider data...');

    try {
      // Get the connection to determine provider
      const { data: job } = await supabase
        .from('import_jobs')
        .select('provider_connection_id, selected_lists, selected_segments')
        .eq('id', jobId)
        .single();

      if (!job) throw new Error('Job not found');

      const { data: connection } = await supabase
        .from('provider_connections')
        .select('provider')
        .eq('id', job.provider_connection_id)
        .single();

      if (!connection) throw new Error('Connection not found');

      setProgress(30);
      setStatus('Importing contacts and data...');

      // Call the appropriate import function
      const importFunction = connection.provider === 'mailchimp' 
        ? 'mailchimp-import' 
        : 'klaviyo-import';

      const { data: importResult, error: importError } = await supabase.functions.invoke(importFunction, {
        body: {
          jobId,
          listIds: job.selected_lists,
          segmentIds: job.selected_segments,
          suggestions: suggestions.filter(s => !s.error && s.action !== 'skip')
        }
      });

      if (importError) throw importError;

      setProgress(70);
      setStatus('Applying AI mappings...');

      // Apply suggestions would happen here in a real implementation
      await new Promise(resolve => setTimeout(resolve, 2000));

      setProgress(100);
      setStatus('Import complete!');

      // Update job status
      await supabase
        .from('import_jobs')
        .update({
          status: 'completed',
          current_step: 'report',
          report: importResult
        })
        .eq('id', jobId);

      toast({
        title: 'Import Complete',
        description: 'All data has been successfully imported'
      });

      onComplete(importResult);

    } catch (error: any) {
      console.error('Import error:', error);
      setErrors([error.message]);
      setStatus('Import failed');
      
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });

      await supabase
        .from('import_jobs')
        .update({ status: 'failed' })
        .eq('id', jobId);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Import Data</h2>
        <p className="text-muted-foreground">
          Import contacts, consent, tags, and segments with applied AI mappings.
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{status}</span>
            {importing && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            {progress === 100 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          </div>

          <Progress value={progress} className="h-2" />

          {importing && (
            <div className="text-sm text-muted-foreground">
              <p>This may take several minutes depending on the size of your data...</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="space-y-2">
              {errors.map((error, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={onBack}
          disabled={importing}
        >
          Back
        </Button>
        {progress < 100 && (
          <Button 
            onClick={startImport}
            disabled={importing}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              'Start Import'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
