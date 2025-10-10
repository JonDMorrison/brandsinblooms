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

interface CustomerData {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface ImportResult {
  found: CustomerData[];
  created: CustomerData[];
  alreadyAdded: string[];
  notFound: string[];
}

interface ImportProgress {
  stage: 'idle' | 'parsing' | 'checking' | 'creating' | 'updating' | 'adding' | 'complete';
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
    const csv = 'email,first_name,last_name,phone\ncustomer1@example.com,John,Doe,555-0100\ncustomer2@example.com,Jane,Smith,555-0200';
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

interface CustomerData {
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }

  const parseCSV = async (file: File): Promise<CustomerData[]> => {
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

          // Helper: basic email validator
          const isValidEmail = (val: string) => {
            if (!val) return false;
            const email = val.trim().toLowerCase();
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          };

          // Detect column indices
          let emailColumnIndex = -1;
          let firstNameColumnIndex = -1;
          let lastNameColumnIndex = -1;
          let phoneColumnIndex = -1;

          // Detect email column
          for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase().trim();
            const normalized = headerLower.replace(/[^a-z0-9]/g, '');
            
            // Email detection
            if (emailColumnIndex === -1) {
              const isEmailHeader =
                normalized === 'email' ||
                normalized.includes('emailaddress') ||
                normalized.startsWith('email') ||
                normalized.endsWith('email');

              if (isEmailHeader) {
                const validCount = dataRows.filter(row => isValidEmail(row[i] || '')).length;
                if (validCount > 0) {
                  emailColumnIndex = i;
                  console.log(`✅ Email column: "${headers[i]}" (index ${i})`);
                }
              }
            }

            // First name detection - more flexible matching
            if (firstNameColumnIndex === -1) {
              if (
                normalized === 'firstname' || 
                normalized === 'fname' || 
                normalized === 'first' ||
                normalized === 'givenname' ||
                normalized.includes('firstname')
              ) {
                firstNameColumnIndex = i;
                console.log(`✅ First name column: "${headers[i]}" (index ${i})`);
              }
            }

            // Last name detection - more flexible matching
            if (lastNameColumnIndex === -1) {
              if (
                normalized === 'lastname' || 
                normalized === 'lname' || 
                normalized === 'last' ||
                normalized === 'surname' ||
                normalized === 'familyname' ||
                normalized.includes('lastname')
              ) {
                lastNameColumnIndex = i;
                console.log(`✅ Last name column: "${headers[i]}" (index ${i})`);
              }
            }

            // Phone detection - more flexible matching
            if (phoneColumnIndex === -1) {
              if (
                normalized === 'phone' || 
                normalized === 'phonenumber' || 
                normalized === 'mobile' || 
                normalized === 'cell' ||
                normalized === 'telephone' ||
                normalized.includes('phone')
              ) {
                phoneColumnIndex = i;
                console.log(`✅ Phone column: "${headers[i]}" (index ${i})`);
              }
            }
          }

          // Fallback: detect email by content if header detection failed
          if (emailColumnIndex === -1) {
            let maxValidCount = 0;
            headers.forEach((header, index) => {
              const validCount = dataRows.filter(row => isValidEmail(row[index] || '')).length;
              if (validCount > maxValidCount) {
                maxValidCount = validCount;
                emailColumnIndex = index;
              }
            });

            if (emailColumnIndex === -1 || maxValidCount < 5) {
              throw new Error('No email column detected');
            }
            console.log(`✅ Email column detected by content: "${headers[emailColumnIndex]}" (index ${emailColumnIndex})`);
          }

          // Extract customer data
          const customers: CustomerData[] = dataRows
            .map(row => {
              const email = (row[emailColumnIndex] || '').trim().toLowerCase();
              if (!isValidEmail(email)) return null;

              const customer: CustomerData = { email };
              
              if (firstNameColumnIndex !== -1 && row[firstNameColumnIndex]) {
                customer.first_name = row[firstNameColumnIndex].trim();
              }
              
              if (lastNameColumnIndex !== -1 && row[lastNameColumnIndex]) {
                customer.last_name = row[lastNameColumnIndex].trim();
              }
              
              if (phoneColumnIndex !== -1 && row[phoneColumnIndex]) {
                // Clean phone number
                const phone = row[phoneColumnIndex].trim().replace(/[^\d+()-]/g, '');
                if (phone) customer.phone = phone;
              }

              return customer;
            })
            .filter((c): c is CustomerData => c !== null);
          
          console.log('✅ Valid customers extracted:', customers.length);
          console.log('📧 Sample data:', customers.slice(0, 3));
          
          resolve(customers);
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
      const customers = await parseCSV(file);
      console.log('✅ CSV parsed successfully, customers found:', customers.length);
      
      if (customers.length === 0) {
        toast({
          title: "No valid customers found",
          description: "Couldn't find valid customer data. Make sure your CSV has emails with @ symbols.",
          variant: "destructive",
        });
        setImporting(false);
        setProgress({ stage: 'idle', current: 0, total: 0, message: '' });
        return;
      }

      console.log('🔍 Found customers to import:', customers.length);
      console.log('📧 Sample data:', customers.slice(0, 3));
      
      // Deduplicate by email (case-insensitive)
      const uniqueCustomersMap = new Map<string, CustomerData>();
      customers.forEach(customer => {
        const emailLower = customer.email.toLowerCase();
        if (!uniqueCustomersMap.has(emailLower)) {
          uniqueCustomersMap.set(emailLower, customer);
        }
      });
      const uniqueCustomers = Array.from(uniqueCustomersMap.values());
      console.log('🔄 After deduplication:', uniqueCustomers.length, 'unique customers');
      
      if (uniqueCustomers.length < customers.length) {
        console.log('⚠️ Removed', customers.length - uniqueCustomers.length, 'duplicate emails');
      }
      
      setProgress({ 
        stage: 'checking', 
        current: 0, 
        total: uniqueCustomers.length, 
        message: 'Checking existing customers...' 
      });

      // Check which emails already exist - process in batches to avoid URL length limits
      console.log('🔍 Checking existing customers in tenant:', tenantId);
      const BATCH_SIZE = 100;
      const existingCustomersMap = new Map<string, { id: string; data: CustomerData }>();
      
      for (let i = 0; i < uniqueCustomers.length; i += BATCH_SIZE) {
        const batch = uniqueCustomers.slice(i, i + BATCH_SIZE);
        const batchEmails = batch.map(c => c.email);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(uniqueCustomers.length / BATCH_SIZE);
        console.log(`📦 Checking batch ${batchNum}/${totalBatches} (${batch.length} customers)`);
        
        setProgress({ 
          stage: 'checking', 
          current: i, 
          total: uniqueCustomers.length, 
          message: 'Checking existing customers...',
          batchInfo: `Batch ${batchNum}/${totalBatches}`
        });
        
        const { data: batchCustomers, error: fetchError } = await supabase
          .from('crm_customers')
          .select('id, email')
          .eq('tenant_id', tenantId)
          .in('email', batchEmails);

        if (fetchError) {
          console.error('❌ Error fetching batch:', fetchError);
          throw fetchError;
        }

        batchCustomers?.forEach(c => {
          const customerData = batch.find(b => b.email === c.email);
          if (customerData) {
            existingCustomersMap.set(c.email.toLowerCase(), { id: c.id, data: customerData });
          }
        });
      }

      console.log('✅ Existing customers found:', existingCustomersMap.size);

      const found: CustomerData[] = [];
      const toCreate: CustomerData[] = [];

      uniqueCustomers.forEach(customer => {
        if (existingCustomersMap.has(customer.email.toLowerCase())) {
          found.push(customer);
          existingCustomerCount++;
        } else {
          toCreate.push(customer);
          newCustomerCount++;
        }
      });

      console.log('📊 Analysis: Found:', found.length, 'To Create:', toCreate.length);

      // Update existing customers with provided names/phone
      const updates = found
        .filter(c => !!(c.first_name || c.last_name || c.phone))
        .map(c => ({
          email: c.email,
          tenant_id: tenantId,
          ...(c.first_name ? { first_name: c.first_name } : {}),
          ...(c.last_name ? { last_name: c.last_name } : {}),
          ...(c.phone ? { phone: c.phone } : {}),
        }));

      if (updates.length > 0) {
        console.log('✏️ Updating existing customers with names/phone:', updates.length);
        setProgress({ stage: 'updating', current: 0, total: updates.length, message: 'Updating existing customers...' });
        const { error: updateError } = await supabase
          .from('crm_customers')
          .upsert(updates, { onConflict: 'email,tenant_id', ignoreDuplicates: false });
        if (updateError) {
          console.error('❌ Error updating existing customers:', updateError);
          toast({
            title: 'Update issue',
            description: `Some existing customers could not be updated: ${updateError.message}`,
            variant: 'destructive',
          });
        }
      }

      // Create new customers in batches
      const created: CustomerData[] = [];
      if (toCreate.length > 0) {
        console.log('➕ Creating', toCreate.length, 'new customers...');
        setProgress({ 
          stage: 'creating', 
          current: 0, 
          total: toCreate.length, 
          message: 'Creating new customers...' 
        });
        
        const CREATE_BATCH_SIZE = 500; // Reduced to avoid database limits
        
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
          
          const newCustomers = batch.map(customer => ({
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
            tenant_id: tenantId,
            user_id: userId,
            email_opt_in: false,
            email_consent_source: 'import',
            email_consent_method: 'pending_confirmation',
          }));

          const { data: createdCustomers, error: createError } = await supabase
            .from('crm_customers')
            .insert(newCustomers)
            .select('id, email, first_name, last_name, phone');

          if (createError) {
            console.error('❌ Error creating batch:', createError);
            console.error('❌ Error details:', JSON.stringify(createError, null, 2));
            toast({
              title: "Partial import",
              description: `Created ${created.length} customers so far. Error: ${createError.message}`,
              variant: "destructive",
            });
            // Continue with next batch instead of breaking
            continue;
          } else if (createdCustomers) {
            console.log('✅ Created customers in batch:', createdCustomers.length);
            createdCustomers.forEach((c, idx) => {
              const customerData = batch[idx];
              created.push(customerData);
              existingCustomersMap.set(c.email.toLowerCase(), { id: c.id, data: customerData });
            });
          }
        }
      }

      // Collect all customer IDs to add to segment
      const allCustomerEmails = [...found, ...created].map(c => c.email.toLowerCase());
      const customerIdsToAdd = allCustomerEmails
        .map(email => existingCustomersMap.get(email)?.id)
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
        const createdEmails = created.map(c => c.email);
        const { data: newCustomerRecords } = await supabase
          .from('crm_customers')
          .select('id, email, first_name')
          .eq('tenant_id', tenantId)
          .in('email', createdEmails);
        
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
              <li>Upload CSV with email, first_name, last_name, phone</li>
              <li>Email column auto-detected (required)</li>
              <li>Other columns detected automatically</li>
              <li>New customers created with full data</li>
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
