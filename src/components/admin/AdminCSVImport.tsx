import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAdminTenantActions } from '@/hooks/useAdminTenantActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const AdminCSVImport = () => {
  const { activeTenantId } = useAdmin();
  const { importCustomers } = useAdminTenantActions();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const customers = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const customer: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        // Map common CSV headers to our schema
        switch (header.toLowerCase()) {
          case 'email':
          case 'email address':
            customer.email = value;
            break;
          case 'first name':
          case 'firstname':
            customer.first_name = value;
            break;
          case 'last name':
          case 'lastname':
            customer.last_name = value;
            break;
          case 'phone':
          case 'phone number':
            customer.phone = value;
            break;
          case 'sms opt-in':
          case 'sms_opt_in':
            customer.sms_opt_in = value.toLowerCase() === 'true' || value === '1';
            break;
          default:
            // Store unknown fields in custom_fields
            if (!customer.custom_fields) customer.custom_fields = {};
            customer.custom_fields[header] = value;
        }
      });
      
      if (customer.email) {
        customers.push(customer);
      }
    }
    
    return customers;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    if (!activeTenantId) {
      toast.error('Please select a tenant first');
      return;
    }

    setIsProcessing(true);

    try {
      const text = await file.text();
      const customers = parseCSV(text);

      if (customers.length === 0) {
        toast.error('No valid customer records found in CSV');
        setIsProcessing(false);
        return;
      }

      const result = await importCustomers(customers);

      if (!result.error) {
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      console.error('CSV import error:', error);
      toast.error(error.message || 'Failed to import CSV');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Customers from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to import customers for the selected tenant
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!activeTenantId ? (
          <div className="flex items-center gap-2 p-4 bg-warning/10 rounded-md">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-sm">Please select a tenant first to import customers</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="csv-file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {file ? file.name : 'Click to select CSV file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    CSV should have headers: email, first_name, last_name, phone, sms_opt_in
                  </p>
                </div>
              </label>
            </div>

            {file && (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </span>
                </div>

                <Button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? 'Importing...' : 'Import Customers'}
                </Button>
              </div>
            )}

            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">CSV Format Example:</p>
              <code className="text-xs bg-background p-2 rounded block">
                email,first_name,last_name,phone,sms_opt_in<br/>
                john@example.com,John,Doe,+15551234567,true<br/>
                jane@example.com,Jane,Smith,+15557654321,false
              </code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};