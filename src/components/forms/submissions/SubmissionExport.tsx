import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { FormSubmission } from '@/types/formBuilder';
import { useToast } from '@/hooks/use-toast';

interface SubmissionExportProps {
  submissions: FormSubmission[];
  formName: string;
}

export function SubmissionExport({ submissions, formName }: SubmissionExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      // Get all unique data keys across submissions
      const allDataKeys = new Set<string>();
      submissions.forEach(sub => {
        Object.keys(sub.data || {}).forEach(key => {
          if (!key.startsWith('_')) allDataKeys.add(key);
        });
      });

      // Build header row
      const headers = [
        'Submitted At',
        'Result',
        'Reason',
        ...Array.from(allDataKeys),
        'Email Consent',
        'SMS Consent',
        'Page URL',
        'UTM Source',
        'UTM Campaign',
        'Customer ID',
      ];

      // Build data rows
      const rows = submissions.map(sub => {
        const metadata = sub.metadata || {};
        const data = sub.data || {};
        
        return [
          new Date(sub.submitted_at).toISOString(),
          sub.result,
          sub.reason || '',
          ...Array.from(allDataKeys).map(key => String(data[key] ?? '')),
          metadata.email_consent ? 'Yes' : 'No',
          metadata.sms_consent ? 'Yes' : 'No',
          metadata.page_url || '',
          metadata.utm_source || '',
          metadata.utm_campaign || '',
          sub.customer_id || '',
        ];
      });

      // Escape CSV values
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // Build CSV content
      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formName.replace(/\s+/g, '_')}_submissions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${submissions.length} submissions to CSV.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export submissions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    try {
      const exportData = submissions.map(sub => ({
        id: sub.id,
        submitted_at: sub.submitted_at,
        result: sub.result,
        reason: sub.reason,
        customer_id: sub.customer_id,
        data: sub.data,
        metadata: sub.metadata,
      }));

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formName.replace(/\s+/g, '_')}_submissions_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${submissions.length} submissions to JSON.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export submissions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (submissions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileText className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
