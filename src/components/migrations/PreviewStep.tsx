import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Mail, Tag, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PreviewStepProps {
  jobId: string;
  onComplete: () => void;
  onBack: () => void;
}

interface PreviewData {
  contacts: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    status?: string;
  }>;
  lists: Array<{ id: string; name: string; memberCount: number }>;
  segments: Array<{ id: string; name: string; memberCount: number }>;
  totalEstimated: number;
  estimatedDuration: string;
}

export const PreviewStep = ({ jobId, onComplete, onBack }: PreviewStepProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, [jobId]); // fetchPreview is stable, no need to include

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get job details
      const { data: job } = await supabase
        .from('import_jobs')
        .select('provider, config')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      const functionName = job.provider === 'mailchimp'
        ? 'mailchimp-fetch-preview'
        : 'klaviyo-fetch-preview';

      // Fetch preview data
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { jobId }
      });

      if (error) throw error;

      setPreview(data);
    } catch (err: any) {
      console.error('Preview error:', err);
      setError(err.message);
      toast({
        title: 'Preview Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-medium">Unable to fetch preview</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={fetchPreview}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Preview Import Data</h2>
        <p className="text-muted-foreground">
          Review sample data before importing. This preview shows the first 10 contacts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{preview.totalEstimated.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{preview.lists.length}</p>
              <p className="text-sm text-muted-foreground">Lists</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Tag className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{preview.segments.length}</p>
              <p className="text-sm text-muted-foreground">Segments</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Estimated Duration */}
      <Card className="p-4 bg-muted">
        <p className="text-sm">
          <span className="font-medium">Estimated Duration:</span> {preview.estimatedDuration}
        </p>
      </Card>

      {/* Sample Contacts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sample Contacts (First 10)</h3>
        {preview.contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No contacts found in selected lists/segments</p>
            <p className="text-sm mt-2">Please go back and select different data sources</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.contacts.map((contact, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{contact.email}</TableCell>
                    <TableCell>{contact.firstName || '—'}</TableCell>
                    <TableCell>{contact.lastName || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        contact.status === 'subscribed' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {contact.status || 'unknown'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Lists */}
      {preview.lists.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Lists to Import</h3>
          <div className="space-y-2">
            {preview.lists.map((list) => (
              <div key={list.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">{list.name}</span>
                <span className="text-sm text-muted-foreground">{list.memberCount} members</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Segments */}
      {preview.segments.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Segments to Import</h3>
          <div className="space-y-2">
            {preview.segments.map((segment) => (
              <div key={segment.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="font-medium">{segment.name}</span>
                <span className="text-sm text-muted-foreground">{segment.memberCount} members</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onComplete}>
          Continue to Analysis
        </Button>
      </div>
    </div>
  );
};
