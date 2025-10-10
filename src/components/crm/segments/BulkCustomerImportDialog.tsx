import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, Check, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BulkCustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (customerIds: string[]) => Promise<void>;
  availableCustomers: Array<{ id: string; email: string }>;
  tenantId: string;
  userId: string;
}

interface ImportResult {
  found: string[];
  created: string[];
  alreadyAdded: string[];
  notFound: string[];
}

export const BulkCustomerImportDialog: React.FC<BulkCustomerImportDialogProps> = ({
  open,
  onOpenChange,
  onImport,
  availableCustomers,
  tenantId,
  userId
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const csv = 'email\ncustomer1@example.com\ncustomer2@example.com';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const parseCSV = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
          
          // Skip header row if it exists
          const emails = lines
            .filter(line => !line.toLowerCase().startsWith('email'))
            .map(line => line.split(',')[0].trim().toLowerCase())
            .filter(email => email && email.includes('@'));
          
          resolve(emails);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    try {
      const emails = await parseCSV(file);
      
      if (emails.length === 0) {
        toast({
          title: "No emails found",
          description: "The CSV file contains no valid email addresses",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Check which emails already exist in the CRM
      const { data: existingCustomers } = await supabase
        .from('crm_customers')
        .select('id, email')
        .eq('tenant_id', tenantId)
        .in('email', emails);

      const existingEmailsMap = new Map(
        (existingCustomers || []).map(c => [c.email.toLowerCase(), c.id])
      );

      const found: string[] = [];
      const toCreate: string[] = [];

      emails.forEach(email => {
        if (existingEmailsMap.has(email)) {
          found.push(email);
        } else {
          toCreate.push(email);
        }
      });

      // Create new customers for emails not in database
      const created: string[] = [];
      if (toCreate.length > 0) {
        const newCustomers = toCreate.map(email => ({
          email,
          tenant_id: tenantId,
          user_id: userId
        }));

        const { data: createdCustomers, error: createError } = await supabase
          .from('crm_customers')
          .insert(newCustomers)
          .select('id, email');

        if (createError) {
          console.error('Error creating customers:', createError);
          toast({
            title: "Partial import",
            description: "Some customers could not be created",
            variant: "destructive",
          });
        } else if (createdCustomers) {
          createdCustomers.forEach(c => {
            created.push(c.email);
            existingEmailsMap.set(c.email.toLowerCase(), c.id);
          });
        }
      }

      // Collect all customer IDs to add to segment
      const customerIdsToAdd = emails
        .map(email => existingEmailsMap.get(email))
        .filter((id): id is string => Boolean(id));

      if (customerIdsToAdd.length > 0) {
        await onImport(customerIdsToAdd);
      }

      setResult({
        found,
        created,
        alreadyAdded: [],
        notFound: []
      });

      const totalAdded = found.length + created.length;
      toast({
        title: "Import complete",
        description: `${totalAdded} customer${totalAdded !== 1 ? 's' : ''} added to segment${created.length > 0 ? ` (${created.length} new)` : ''}`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "Failed to process the CSV file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <p className="font-medium">Need a template?</p>
              <p className="text-muted-foreground text-xs">Download a sample CSV file</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  {file ? 'Change File' : 'Choose CSV File'}
                </span>
              </Button>
            </label>
            {file && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-2 text-sm">
              {result.found.length > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-4 w-4" />
                  <span>{result.found.length} existing customer{result.found.length !== 1 ? 's' : ''} added</span>
                </div>
              )}
              {result.created.length > 0 && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Check className="h-4 w-4" />
                  <span>{result.created.length} new customer{result.created.length !== 1 ? 's' : ''} created & added</span>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">CSV Format:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Must include "email" column header</li>
              <li>One email address per row</li>
              <li>New customers will be created automatically</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
