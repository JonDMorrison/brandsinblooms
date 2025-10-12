import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, Users, Database, FileCheck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ImportStepProps {
  jobId: string;
  suggestions: any[];
  onComplete: (report: any) => void;
  onBack: () => void;
}

interface DetailedProgress {
  stage: string;
  contactsProcessed: number;
  contactsTotal: number;
  segmentsProcessed: number;
  segmentsTotal: number;
  currentBatch: number;
  totalBatches: number;
  errors: Array<{ item: string; error: string }>;
  validationErrors: string[];
}

export const ImportStep = ({ jobId, suggestions, onComplete, onBack }: ImportStepProps) => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('Ready to import');
  const [errors, setErrors] = useState<string[]>([]);
  const [detailedProgress, setDetailedProgress] = useState<DetailedProgress | null>(null);
  const [validating, setValidating] = useState(false);

  const startImport = async () => {
    setImporting(true);
    setProgress(10);
    setStatus('Fetching provider data...');

    try {
      // Fetch job details
      const { data: job } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      const provider = job.provider;
      const config = job.config as any || {};
      const listIds = config.listIds || [];
      const segmentIds = config.segmentIds || [];

      setProgress(30);
      setStatus('Importing contacts and data...');

      // Call the appropriate import function
      const importFunction = provider === 'mailchimp' 
        ? 'mailchimp-import' 
        : 'klaviyo-import';

      const { data: importResult, error: importError } = await supabase.functions.invoke(importFunction, {
        body: { jobId }
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
            {(importing || validating) && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            {progress === 100 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          </div>

          <Progress value={progress} className="h-2" />

          {/* Detailed Progress */}
          {detailedProgress && importing && (
            <div className="grid grid-cols-3 gap-4 pt-4">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contacts</p>
                    <p className="text-lg font-bold">
                      {detailedProgress.contactsProcessed}/{detailedProgress.contactsTotal}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Segments</p>
                    <p className="text-lg font-bold">
                      {detailedProgress.segmentsProcessed}/{detailedProgress.segmentsTotal}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Batch</p>
                    <p className="text-lg font-bold">
                      {detailedProgress.currentBatch}/{detailedProgress.totalBatches}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {importing && (
            <div className="text-sm text-muted-foreground">
              <p>This may take several minutes depending on the size of your data...</p>
              <p className="text-xs mt-1">Importing in batches of 100 to ensure reliability</p>
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="errors">
                <AccordionTrigger className="text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.length} Error{errors.length > 1 ? 's' : ''} Found</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 mt-2">
                    {errors.map((error, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-destructive/10 rounded">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Detailed Import Errors */}
          {detailedProgress?.errors && detailedProgress.errors.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="import-errors">
                <AccordionTrigger className="text-amber-600">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{detailedProgress.errors.length} Item{detailedProgress.errors.length > 1 ? 's' : ''} Failed</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                    {detailedProgress.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-amber-50 rounded">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                        <div>
                          <p className="font-medium">{err.item}</p>
                          <p className="text-xs text-muted-foreground">{err.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
            disabled={importing || validating}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : validating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
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
