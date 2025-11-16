import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblemDetail } from '@/hooks/reportProblem/useProblemDetail';
import { useUpdateProblem } from '@/hooks/reportProblem/useUpdateProblem';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { ProblemStatusBadge } from '@/components/reportProblem/ProblemStatusBadge';
import { ProblemPriorityBadge } from '@/components/reportProblem/ProblemPriorityBadge';
import { ArrowLeft, Download, FileIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ProblemStatus, ProblemPriority } from '@/types/reportedProblems';

const ReportedProblemDetailPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { data: problem, isLoading } = useProblemDetail(problemId);
  const updateProblem = useUpdateProblem();

  const [adminNotes, setAdminNotes] = useState('');

  if (!isSuperAdmin) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center py-8 text-muted-foreground">
          Loading problem details...
        </div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Problem Not Found</CardTitle>
            <CardDescription>
              The problem you're looking for doesn't exist.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateProblem.mutate({ problemId: problem.id, status: e.target.value as ProblemStatus });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateProblem.mutate({ problemId: problem.id, priority: e.target.value as ProblemPriority });
  };

  const handleSaveNotes = () => {
    updateProblem.mutate({ problemId: problem.id, admin_notes: adminNotes });
  };

  const downloadAttachment = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage
      .from('problem-attachments')
      .download(filePath);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{problem.title}</h1>
          <p className="text-muted-foreground">
            Reported by {problem.user_email} on{' '}
            {format(new Date(problem.created_at), 'PPp')}
          </p>
        </div>
      </div>

      {/* Status and Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Priority</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <NativeSelect
                value={problem.status}
                onChange={handleStatusChange}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'investigating', label: 'Investigating' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <NativeSelect
                value={problem.priority}
                onChange={handlePriorityChange}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Problem Details */}
      <Card>
        <CardHeader>
          <CardTitle>Problem Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{problem.description}</p>
        </CardContent>
      </Card>

      {/* Captured Context */}
      <Card>
        <CardHeader>
          <CardTitle>Captured Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong className="text-sm">URL:</strong>
            <p className="text-sm text-muted-foreground break-all">
              <a
                href={problem.captured_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {problem.captured_url}
              </a>
            </p>
          </div>
          {problem.viewport_size && (
            <div>
              <strong className="text-sm">Viewport:</strong>
              <p className="text-sm text-muted-foreground">
                {problem.viewport_size}
              </p>
            </div>
          )}
          {problem.user_agent && (
            <div>
              <strong className="text-sm">User Agent:</strong>
              <p className="text-sm text-muted-foreground break-all">
                {problem.user_agent}
              </p>
            </div>
          )}
          {problem.browser_info && (
            <div>
              <strong className="text-sm">Browser Info:</strong>
              <pre className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                {JSON.stringify(problem.browser_info, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {problem.attachments && problem.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {problem.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-muted rounded"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">
                        {attachment.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(attachment.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      downloadAttachment(
                        attachment.file_path,
                        attachment.file_name
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Notes</CardTitle>
          <CardDescription>
            Internal notes about this problem (not visible to the user)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Add notes about investigation, resolution, etc..."
            rows={5}
            value={adminNotes || problem.admin_notes || ''}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
          <Button onClick={handleSaveNotes} disabled={updateProblem.isPending}>
            {updateProblem.isPending ? 'Saving...' : 'Save Notes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportedProblemDetailPage;
