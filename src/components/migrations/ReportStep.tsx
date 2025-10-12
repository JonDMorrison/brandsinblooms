import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, CheckCircle2, Unplug } from 'lucide-react';

interface ReportStepProps {
  jobId: string;
  report: any;
  onDisconnect: () => void;
}

export const ReportStep = ({ jobId, report, onDisconnect }: ReportStepProps) => {
  const { toast } = useToast();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDownloadReport = () => {
    const reportData = {
      jobId,
      timestamp: new Date().toISOString(),
      summary: report || {
        contacts_imported: 0,
        segments_created: 0,
        personas_created: 0,
        tags_imported: 0,
        suppressions_added: 0
      }
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Downloaded',
      description: 'Migration report has been saved'
    });
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Get the connection ID from the job
      const { data: job } = await supabase
        .from('import_jobs')
        .select('provider_connection_id')
        .eq('id', jobId)
        .single();

      if (!job) throw new Error('Job not found');

      // Revoke the connection
      await supabase
        .from('provider_connections')
        .update({
          status: 'disconnected',
          revoked_at: new Date().toISOString()
        })
        .eq('id', job.provider_connection_id);

      toast({
        title: 'Provider Disconnected',
        description: 'OAuth tokens have been revoked'
      });

      onDisconnect();
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast({
        title: 'Disconnect Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const summary = report || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Migration Complete</h2>
        <p className="text-muted-foreground">
          Your migration has been completed successfully. Review the summary below.
        </p>
      </div>

      <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold">Import Successful</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All data has been imported and is now available in BloomSuite.
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Contacts Imported</p>
            <p className="text-2xl font-bold">{summary.contacts_imported?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Segments Created</p>
            <p className="text-2xl font-bold">{summary.segments_created || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Personas Created</p>
            <p className="text-2xl font-bold">{summary.personas_created || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tags Imported</p>
            <p className="text-2xl font-bold">{summary.tags_imported || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Suppressions Added</p>
            <p className="text-2xl font-bold">{summary.suppressions_added || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Errors</p>
            <p className="text-2xl font-bold text-destructive">{summary.errors?.length || 0}</p>
          </div>
        </div>

        {summary.errors && summary.errors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-2">Errors</h4>
            <div className="space-y-1">
              {summary.errors.slice(0, 5).map((error: string, i: number) => (
                <p key={i} className="text-sm text-destructive">{error}</p>
              ))}
              {summary.errors.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  + {summary.errors.length - 5} more errors
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleDownloadReport}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
        <Button
          variant="destructive"
          onClick={handleDisconnect}
          disabled={disconnecting}
        >
          <Unplug className="w-4 h-4 mr-2" />
          {disconnecting ? 'Disconnecting...' : 'Disconnect Provider'}
        </Button>
      </div>
    </div>
  );
};
