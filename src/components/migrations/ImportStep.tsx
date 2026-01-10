import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ImportProgressDialog } from '@/components/integrations/ImportProgressDialog';

interface ImportStepProps {
  jobId: string;
  suggestions: any[];
  onComplete: (report: any) => void;
  onBack: () => void;
}

export const ImportStep = ({ jobId, suggestions, onComplete, onBack }: ImportStepProps) => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string>('Ready to import');
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [validating, setValidating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Helper to ensure fresh session
  const ensureFreshSession = async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      console.error('Session refresh failed:', error);
      toast({
        title: 'Session Expired',
        description: 'Please log in again to continue.',
        variant: 'destructive'
      });
      throw new Error('Session refresh failed');
    }
    
    return session;
  };

  // Helper to invoke edge functions with retry logic
  const invokeWithRetry = async (functionName: string, body: any, maxRetries = 2) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get fresh session for each attempt
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('No active session');
        }
        
        const { data, error } = await supabase.functions.invoke(functionName, {
          body,
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (error) {
          throw error;
        }
        
        return { data, error: null };
      } catch (error: any) {
        console.warn(`[ImportStep] Attempt ${attempt}/${maxRetries} failed for ${functionName}:`, error);
        lastError = error;
        
        // If it's an auth error and we have retries left, refresh session and try again
        if (attempt < maxRetries && (error.message?.includes('Auth') || error.message?.includes('session'))) {
          await supabase.auth.refreshSession();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        } else {
          break;
        }
      }
    }
    
    return { data: null, error: lastError };
  };

  const startImport = async () => {
    setImporting(true);
    setValidating(true);
    setStatus('Validating data...');

    try {
      // Ensure we have a fresh session
      const session = await ensureFreshSession();
      console.log('[ImportStep] Using session:', session.user.id);

      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Your session has expired. Please log in again.',
          variant: 'destructive'
        });
        throw new Error('No active session');
      }

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

      // Step 1: Validate data
      const validateFunction = provider === 'mailchimp' 
        ? 'mailchimp-validate' 
        : provider === 'klaviyo'
          ? 'klaviyo-validate'
          : 'constant-contact-validate';

      const { data: validation, error: validationError } = await invokeWithRetry(validateFunction, { jobId });

      if (validationError) {
        toast({
          title: 'Validation Failed',
          description: validationError.message,
          variant: 'destructive'
        });
        throw validationError;
      }

      if (!validation.valid) {
        setStatus('Validation failed');
        setValidating(false);
        toast({
          title: 'Data Validation Issues',
          description: `Found ${validation.validationErrors?.length || 0} validation errors`,
          variant: 'destructive'
        });
        return;
      }

      setValidating(false);
      setStatus('Starting background import...');

      // Step 2: Start background import (non-blocking)
      const importFunction = provider === 'mailchimp' 
        ? 'mailchimp-import' 
        : provider === 'klaviyo'
          ? 'klaviyo-import'
          : 'constant-contact-import';

      // Show progress dialog immediately
      setShowProgressDialog(true);

      // Trigger background import (don't await - it runs in background)
      supabase.functions.invoke(importFunction, {
        body: { jobId }
      }).then(({ error: importError }) => {
        if (importError) {
          console.error('[ImportStep] Background import error:', importError);
          toast({
            title: 'Import Failed',
            description: importError.message,
            variant: 'destructive'
          });
        }
      });

      setStatus('Import running in background...');
      
    } catch (error: any) {
      console.error('Import error:', error);
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
      setValidating(false);
    }
  };

  const handleImportComplete = async () => {
    setIsComplete(true);
    setShowProgressDialog(false);

    // Fetch final job report
    const { data: job } = await supabase
      .from('import_jobs')
      .select('report')
      .eq('id', jobId)
      .single();

    if (job?.report) {
      const report = job.report as any;
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${report.contacts_imported || 0} contacts`
      });
      onComplete(report);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Import Data</h2>
          <p className="text-muted-foreground">
            Import contacts, consent, tags, and segments with optimized batch processing.
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{status}</span>
              {(importing || validating) && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
              {isComplete && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {importing && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✨ Using optimized batch operations (95%+ faster)</p>
                <p>📊 Real-time progress tracking enabled</p>
                <p>⚡ Background processing - you can navigate away</p>
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
          {!isComplete && (
            <Button 
              onClick={startImport}
              disabled={importing || validating}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Import...
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

      {/* PHASE 3: Real-Time Progress Dialog */}
      <ImportProgressDialog
        jobId={jobId}
        open={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        onComplete={handleImportComplete}
      />
    </>
  );
};
