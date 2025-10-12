import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { ConnectStep } from '@/components/migrations/ConnectStep';
import { ChooseStep } from '@/components/migrations/ChooseStep';
import { AnalyzeStep } from '@/components/migrations/AnalyzeStep';
import { ApplyStep } from '@/components/migrations/ApplyStep';
import { ImportStep } from '@/components/migrations/ImportStep';
import { ReportStep } from '@/components/migrations/ReportStep';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type Step = 'connect' | 'choose' | 'analyze' | 'apply' | 'import' | 'report';

const steps: { id: Step; label: string; description: string }[] = [
  { id: 'connect', label: 'Connect', description: 'Connect to Mailchimp or Klaviyo' },
  { id: 'choose', label: 'Choose', description: 'Select lists, segments, and tags' },
  { id: 'analyze', label: 'Analyze (AI)', description: 'AI recommends mappings' },
  { id: 'apply', label: 'Apply', description: 'Review and apply mappings' },
  { id: 'import', label: 'Import', description: 'Import contacts and data' },
  { id: 'report', label: 'Report', description: 'View final report and disconnect' },
];

const MigrationsPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('connect');
  const [importSelection, setImportSelection] = useState<{ listIds: string[]; segmentIds: string[] } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [importReport, setImportReport] = useState<any>(null);
  
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  const handleConnectComplete = () => {
    setCurrentStep('choose');
  };

  const handleChooseComplete = async (selection: { listIds: string[]; segmentIds: string[] }) => {
    setImportSelection(selection);
    
    // Create import job
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) return;

      // Determine provider from connection
      const { data: connection } = await supabase
        .from('provider_connections')
        .select('provider')
        .eq('status', 'connected')
        .in('provider', ['mailchimp', 'klaviyo'])
        .maybeSingle();

      if (!connection) return;

      const { data: jobData, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          provider: connection.provider,
          status: 'pending',
          config: selection,
        })
        .select()
        .single();

      if (jobError) {
        console.error('Error creating job:', jobError);
        return;
      }

      if (jobData) {
        setJobId(jobData.id);
        setCurrentStep('analyze');
      }
    } catch (error) {
      console.error('Error creating job:', error);
    }
  };

  const handleAnalyzeComplete = (suggestions: any[]) => {
    setAiSuggestions(suggestions);
    setCurrentStep('apply');
  };

  const handleApplyComplete = () => {
    setCurrentStep('import');
  };

  const handleImportComplete = (report: any) => {
    setImportReport(report);
    setCurrentStep('report');
  };

  const handleDisconnect = () => {
    // Reset wizard and navigate back
    setCurrentStep('connect');
    setImportSelection(null);
    setJobId(null);
    setAiSuggestions([]);
    setImportReport(null);
    navigate('/integrations');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">One-Time Migration</h1>
        <p className="text-muted-foreground">
          Import contacts, consent, tags, and segments from Mailchimp or Klaviyo
        </p>
      </div>

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    index < currentStepIndex
                      ? 'bg-primary border-primary text-primary-foreground'
                      : index === currentStepIndex
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`font-medium text-sm ${
                    index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[120px]">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Step Content */}
      <Card className="p-8">
        {currentStep === 'connect' && <ConnectStep onComplete={handleConnectComplete} />}
        {currentStep === 'choose' && (
          <ChooseStep 
            onComplete={handleChooseComplete} 
            onBack={() => setCurrentStep('connect')} 
          />
        )}
        {currentStep === 'analyze' && jobId && (
          <AnalyzeStep 
            jobId={jobId}
            onComplete={handleAnalyzeComplete}
            onBack={() => setCurrentStep('choose')}
          />
        )}
        {currentStep === 'apply' && (
          <ApplyStep 
            suggestions={aiSuggestions}
            onComplete={handleApplyComplete}
            onBack={() => setCurrentStep('analyze')}
          />
        )}
        {currentStep === 'import' && jobId && (
          <ImportStep 
            jobId={jobId}
            suggestions={aiSuggestions}
            onComplete={handleImportComplete}
            onBack={() => setCurrentStep('apply')}
          />
        )}
        {currentStep === 'report' && jobId && (
          <ReportStep 
            jobId={jobId}
            report={importReport}
            onDisconnect={handleDisconnect}
          />
        )}
      </Card>
    </div>
  );
};

export default MigrationsPage;
