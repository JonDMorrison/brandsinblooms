import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, Users, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VMXUploaderProps {
  onSuccess: () => void;
}

export const VMXUploader: React.FC<VMXUploaderProps> = ({ onSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Read and parse CSV
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate required columns
      const requiredColumns = ['name', 'email'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        toast({
          title: "Missing Required Columns",
          description: `CSV must include: ${requiredColumns.join(', ')}`,
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      // Parse data
      const customers = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const customer: any = {};
        
        headers.forEach((header, index) => {
          customer[header] = values[index] || '';
        });
        
        return customer;
      }).filter(customer => customer.email); // Filter out rows without email

      setPreview({
        totalRows: customers.length,
        sampleData: customers.slice(0, 3),
        headers: headers
      });

      // Upload to Supabase via VMX sync function
      const { error } = await supabase.functions.invoke('vmx-sync', {
        body: { 
          csv_data: customers,
          file_name: file.name 
        }
      });

      if (error) throw error;

      onSuccess();
      setPreview(null);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to process CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [onSuccess, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const downloadTemplate = () => {
    const template = `name,email,phone,product,date,amount
John Smith,john@example.com,555-0123,Rose Bush,2024-01-15,29.99
Jane Doe,jane@example.com,555-0456,Garden Tools,2024-01-16,45.00`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vmx-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            VMX Data Upload
          </CardTitle>
          <CardDescription>
            Upload your customer data via CSV file. Make sure to include customer names and email addresses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Need a template?</h4>
              <p className="text-xs text-muted-foreground">
                Download our CSV template to see the correct format.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template
            </Button>
          </div>

          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p>Drop your CSV file here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Drag & drop your CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Maximum file size: 10MB
                </p>
              </div>
            )}
          </div>

          {/* Format Requirements */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-blue-900 dark:text-blue-100">Required Columns:</p>
              <ul className="text-blue-700 dark:text-blue-200 space-y-0.5">
                <li>• <strong>name</strong> - Customer full name</li>
                <li>• <strong>email</strong> - Customer email address</li>
              </ul>
              <p className="font-medium text-blue-900 dark:text-blue-100 pt-1">Optional Columns:</p>
              <ul className="text-blue-700 dark:text-blue-200 space-y-0.5">
                <li>• <strong>phone</strong> - Customer phone number</li>
                <li>• <strong>product</strong> - Product purchased</li>
                <li>• <strong>date</strong> - Purchase date (YYYY-MM-DD)</li>
                <li>• <strong>amount</strong> - Purchase amount</li>
              </ul>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Preview: {preview.totalRows} customers found
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    Columns: {preview.headers.join(', ')}
                  </div>
                  {preview.sampleData.map((customer: any, index: number) => (
                    <div key={index} className="text-muted-foreground">
                      {customer.name} • {customer.email}
                      {customer.product && ` • ${customer.product}`}
                    </div>
                  ))}
                  {preview.totalRows > 3 && (
                    <div className="text-muted-foreground">
                      ... and {preview.totalRows - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};