import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, Check, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EnhancedProgress } from '@/components/ui/enhanced-progress';
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

interface ImportProgress {
  stage: 'idle' | 'parsing' | 'checking' | 'creating' | 'adding' | 'complete';
  current: number;
  total: number;
  message: string;
  batchInfo?: string;
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
  const [progress, setProgress] = useState<ImportProgress>({
    stage: 'idle',
    current: 0,
    total: 0,
    message: '',
  });
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
          
          if (!text || text.trim().length === 0) {
            reject(new Error('File is empty'));
            return;
          }

          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          
          if (lines.length === 0) {
            reject(new Error('No data found in file'));
            return;
          }

          console.log('📄 CSV Lines found:', lines.length);
          console.log('📄 First 3 lines:', lines.slice(0, 3));
          
          // Parse CSV into columns (handle quoted fields)
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          // Parse all rows
          const rows = lines.map(parseCSVLine);
          const headers = rows[0];
          const dataRows = rows.slice(1);

          console.log('📊 Headers found:', headers);
          console.log('📊 Data rows:', dataRows.length);

          // Intelligently detect email column
          // Helper: basic email validator
          const isValidEmail = (val: string) => {
            if (!val) return false;
            const email = val.trim().toLowerCase();
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          };

          let emailColumnIndex = -1;

          // Method 1: Prefer explicit header names like "Email" or "Email Address" (no density requirement)
          for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase().trim();
            const normalized = headerLower.replace(/[^a-z0-9]/g, '');
            const isEmailHeader =
              normalized === 'email' ||
              normalized.includes('emailaddress') ||
              normalized.startsWith('email') ||
              normalized.endsWith('email');

            if (isEmailHeader) {
              const validCount = dataRows.filter(row => isValidEmail(row[i] || '')).length;
              const density = dataRows.length > 0 ? validCount / dataRows.length : 0;
              console.log(`📧 Header match "${headers[i]}" → valid emails: ${validCount}/${dataRows.length} (${(density * 100).toFixed(1)}%)`);
              if (validCount > 0) {
                emailColumnIndex = i;
                console.log(`✅ Email column selected by header: "${headers[i]}" (index ${i})`);
                break;
              }
            }
          }

          // Method 2: Fallback by valid email count/density (more lenient than 50%)
          if (emailColumnIndex === -1) {
            let maxValidCount = 0;
            let maxValidDensity = 0;

            headers.forEach((header, index) => {
              const validCount = dataRows.filter(row => isValidEmail(row[index] || '')).length;
              const atCount = dataRows.filter(row => (row[index] || '').includes('@')).length;
              const density = dataRows.length > 0 ? validCount / dataRows.length : 0;
              console.log(`📊 Column "${header}" (idx ${index}): valid ${validCount}/${dataRows.length} (${(density * 100).toFixed(1)}%), has@ ${atCount}`);

              if (validCount > maxValidCount) {
                maxValidCount = validCount;
                maxValidDensity = density;
                emailColumnIndex = index;
              }
            });

            // Accept if we have at least a small number of valid emails OR a small density
            if (emailColumnIndex === -1 || (maxValidCount < 5 && maxValidDensity < 0.02)) {
              throw new Error(`No email column detected. Best column valid rate: ${(maxValidDensity * 100).toFixed(1)}% (${maxValidCount} valid)`);
            }

            console.log(`✅ Email column detected by validity: "${headers[emailColumnIndex]}" (index ${emailColumnIndex}) with ${(maxValidDensity * 100).toFixed(1)}% valid`);
          }

          // Extract and validate emails from the detected column
          const emails = dataRows
            .map(row => (row[emailColumnIndex] || '').trim().toLowerCase())
            .filter(isValidEmail);
          
          console.log('✅ Valid emails extracted:', emails.length);
          console.log('📧 Sample emails:', emails.slice(0, 5));
          
          resolve(emails);
        } catch (error) {
          console.error('❌ CSV Parse error:', error);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress({ stage: 'parsing', current: 0, total: 0, message: 'Reading CSV file...' });
    console.log('🚀 Starting import for file:', file.name);
    
    let existingCustomerCount = 0;
    let newCustomerCount = 0;
    
    try {
      console.log('📖 Parsing CSV...');
      const emails = await parseCSV(file);
      console.log('✅ CSV parsed successfully, emails found:', emails.length);
      
      if (emails.length === 0) {
        toast({
          title: "No valid emails found",
          description: "Couldn't find a column with email addresses. Make sure your CSV has emails with @ symbols.",
          variant: "destructive",
        });
        setImporting(false);
        setProgress({ stage: 'idle', current: 0, total: 0, message: '' });
        return;
      }

      console.log('🔍 Found emails to import:', emails.length);
      console.log('📧 Sample emails:', emails.slice(0, 3));
      
      // Deduplicate emails (case-insensitive)
      const uniqueEmails = Array.from(new Set(emails.map(e => e.toLowerCase())));
      console.log('🔄 After deduplication:', uniqueEmails.length, 'unique emails');
      
      if (uniqueEmails.length < emails.length) {
        console.log('⚠️ Removed', emails.length - uniqueEmails.length, 'duplicate emails');
      }
      
      setProgress({ 
        stage: 'checking', 
        current: 0, 
        total: uniqueEmails.length, 
        message: 'Checking existing customers...' 
      });

      // Check which emails already exist - process in batches to avoid URL length limits
      console.log('🔍 Checking existing customers in tenant:', tenantId);
      const BATCH_SIZE = 100; // Smaller batches to avoid URL size limits
      const existingEmailsMap = new Map<string, string>();
      
      for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
        const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(uniqueEmails.length / BATCH_SIZE);
        console.log(`📦 Checking batch ${batchNum}/${totalBatches} (${batch.length} emails)`);
        
        setProgress({ 
          stage: 'checking', 
          current: i, 
          total: uniqueEmails.length, 
          message: 'Checking existing customers...',
          batchInfo: `Batch ${batchNum}/${totalBatches}`
        });
        
        const { data: batchCustomers, error: fetchError } = await supabase
          .from('crm_customers')
          .select('id, email, total_spent, last_purchase_date')
          .eq('tenant_id', tenantId)
          .in('email', batch);

        if (fetchError) {
          console.error('❌ Error fetching batch:', fetchError);
          throw fetchError;
        }

        batchCustomers?.forEach(c => {
          existingEmailsMap.set(c.email.toLowerCase(), c.id);
        });
      }

      console.log('✅ Existing customers found:', existingEmailsMap.size);

      const found: string[] = [];
      const toCreate: string[] = [];

      uniqueEmails.forEach(email => {
        if (existingEmailsMap.has(email)) {
          found.push(email);
          existingCustomerCount++;
        } else {
          toCreate.push(email);
          newCustomerCount++;
        }
      });

      console.log('📊 Analysis: Found:', found.length, 'To Create:', toCreate.length);

      // Create new customers in batches
      const created: string[] = [];
      if (toCreate.length > 0) {
        console.log('➕ Creating', toCreate.length, 'new customers...');
        setProgress({ 
          stage: 'creating', 
          current: 0, 
          total: toCreate.length, 
          message: 'Creating new customers...' 
        });
        
        const CREATE_BATCH_SIZE = 1000; // Create 1000 at a time
        
        for (let i = 0; i < toCreate.length; i += CREATE_BATCH_SIZE) {
          const batch = toCreate.slice(i, i + CREATE_BATCH_SIZE);
          const batchNum = Math.floor(i / CREATE_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(toCreate.length / CREATE_BATCH_SIZE);
          console.log(`✏️ Creating batch ${batchNum}/${totalBatches} (${batch.length} customers)`);
          
          setProgress({ 
            stage: 'creating', 
            current: i, 
            total: toCreate.length, 
            message: 'Creating new customers...',
            batchInfo: `Batch ${batchNum}/${totalBatches}`
          });
          
          const newCustomers = batch.map(email => ({
            email,
            tenant_id: tenantId,
            user_id: userId,
            email_opt_in: false,
            email_consent_source: 'import',
            email_consent_method: 'pending_confirmation',
          }));

          const { data: createdCustomers, error: createError } = await supabase
            .from('crm_customers')
            .insert(newCustomers)
            .select('id, email');

          if (createError) {
            console.error('❌ Error creating batch:', createError);
            toast({
              title: "Partial import",
              description: `Created ${created.length} customers but encountered error: ${createError.message}`,
              variant: "destructive",
            });
            break; // Stop on error
          } else if (createdCustomers) {
            console.log('✅ Created customers in batch:', createdCustomers.length);
            createdCustomers.forEach(c => {
              created.push(c.email);
              existingEmailsMap.set(c.email.toLowerCase(), c.id);
            });
          }
        }
      }

      // Collect all customer IDs to add to segment
      const customerIdsToAdd = emails
        .map(email => existingEmailsMap.get(email))
        .filter((id): id is string => Boolean(id));

      console.log('📝 Adding', customerIdsToAdd.length, 'customers to segment...');
      
      setProgress({ 
        stage: 'adding', 
        current: 0, 
        total: customerIdsToAdd.length, 
        message: 'Adding customers to segment...' 
      });

      if (customerIdsToAdd.length > 0) {
        try {
          await onImport(customerIdsToAdd);
          console.log('✅ Successfully added customers to segment');
        } catch (error) {
          console.error('❌ Error adding customers to segment:', error);
          toast({
            title: "Import issue",
            description: `Customers were created but couldn't be added to segment. ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive",
          });
          throw error;
        }
      }
      
      setProgress({ 
        stage: 'complete', 
        current: customerIdsToAdd.length, 
        total: customerIdsToAdd.length, 
        message: `Successfully imported ${customerIdsToAdd.length} customers!` 
      });

      setResult({
        found,
        created,
        alreadyAdded: [],
        notFound: []
      });

      // Send confirmation emails to new customers
      const { data: companyProfile } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('user_id', userId)
        .single();

      if (created.length > 0) {
        console.log(`📧 Queueing confirmation emails for ${created.length} new customers`);
        
        // Get the newly created customer records with their IDs
        const { data: newCustomerRecords } = await supabase
          .from('crm_customers')
          .select('id, email, first_name')
          .eq('tenant_id', tenantId)
          .in('email', created);
        
        // Queue confirmation emails (fire and forget)
        newCustomerRecords?.forEach(customer => {
          supabase.functions.invoke('send-email-confirmation', {
            body: {
              customerId: customer.id,
              email: customer.email,
              firstName: customer.first_name,
              brandName: companyProfile?.company_name,
            }
          }).catch(err => console.error(`Failed to send confirmation to ${customer.email}:`, err));
        });
      }

      const totalAdded = found.length + created.length;
      console.log('🎉 Import complete! Total added:', totalAdded);
      toast({
        title: "Import complete",
        description: existingCustomerCount > 0 
          ? `${existingCustomerCount} existing customers found. ${newCustomerCount} new contacts added - confirmation emails queued.`
          : `Successfully imported ${newCustomerCount} new customers. Confirmation emails queued.`,
      });

    } catch (error: any) {
      console.error('❌ Import error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      setProgress({ stage: 'idle', current: 0, total: 0, message: '' });
      toast({
        title: "Import failed",
        description: error.message || "Failed to process the CSV file. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      console.log('✅ Import process finished');
      // Reset progress after showing complete for 2 seconds
      if (progress.stage === 'complete') {
        setTimeout(() => {
          setProgress({ stage: 'idle', current: 0, total: 0, message: '' });
        }, 2000);
      }
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setProgress({ stage: 'idle', current: 0, total: 0, message: '' });
    onOpenChange(false);
  };

  const getStageLabel = (stage: ImportProgress['stage']) => {
    switch (stage) {
      case 'parsing': return 'Parsing CSV';
      case 'checking': return 'Checking Existing';
      case 'creating': return 'Creating Customers';
      case 'adding': return 'Adding to Segment';
      case 'complete': return 'Complete';
      default: return '';
    }
  };

  const getStageNumber = (stage: ImportProgress['stage']) => {
    switch (stage) {
      case 'parsing': return 1;
      case 'checking': return 2;
      case 'creating': return 3;
      case 'adding': return 4;
      case 'complete': return 4;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Indicator */}
          {progress.stage !== 'idle' && progress.stage !== 'complete' && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Stage {getStageNumber(progress.stage)}/4: {getStageLabel(progress.stage)}
                </span>
                {progress.batchInfo && (
                  <span className="text-muted-foreground text-xs">{progress.batchInfo}</span>
                )}
              </div>
              
              <EnhancedProgress 
                value={progress.current} 
                max={progress.total || 1}
                size="md"
                showIcon={true}
              />
              
              <p className="text-sm text-muted-foreground">
                {progress.message}
              </p>
            </div>
          )}

          {/* Completion Message */}
          {progress.stage === 'complete' && (
            <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-100">
                  {progress.message}
                </span>
              </div>
            </div>
          )}
          
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
            <p className="font-medium">How it works:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Upload any CSV with email addresses</li>
              <li>Column with @ symbols auto-detected</li>
              <li>New customers created automatically</li>
              <li>Works with exports from any system</li>
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
