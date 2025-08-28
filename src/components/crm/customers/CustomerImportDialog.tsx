import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface CustomerImportDialogProps {
  onImportComplete?: () => void;
}

interface ParsedCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string;
  tags?: string[];
  lifetime_value?: number;
  last_purchase_date?: string;
  sms_opt_in?: boolean;
  pos_source?: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
  data: any;
}

interface FieldMapping {
  [key: string]: string;
}

export const CustomerImportDialog: React.FC<CustomerImportDialogProps> = ({ onImportComplete }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [appendTags, setAppendTags] = useState(true);
  const [defaultPersona, setDefaultPersona] = useState<string>('');

  // Smart field detection mappings
  const fieldMappings = {
    email: ['email', 'email_address', 'e_mail', 'customer_email', 'mail'],
    first_name: ['first_name', 'firstname', 'given_name', 'fname', 'first'],
    last_name: ['last_name', 'lastname', 'surname', 'family_name', 'lname', 'last'],
    phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'tel'],
    persona: ['persona', 'customer_type', 'segment', 'category', 'type'],
    tags: ['tags', 'interests', 'categories', 'labels'],
    lifetime_value: ['lifetime_value', 'total_spent', 'ltv', 'value', 'spent'],
    last_purchase_date: ['last_purchase', 'last_order', 'recent_purchase', 'last_purchase_date'],
    sms_opt_in: ['sms_opt_in', 'sms_marketing', 'text_opt_in', 'sms_consent'],
    name: ['name', 'full_name', 'customer_name', 'client_name']
  };

  const detectFieldMapping = (headers: string[]): FieldMapping => {
    const mapping: FieldMapping = {};
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    Object.entries(fieldMappings).forEach(([field, variations]) => {
      const match = normalizedHeaders.find(header => 
        variations.some(variation => header.includes(variation))
      );
      if (match) {
        const originalHeader = headers[normalizedHeaders.indexOf(match)];
        mapping[originalHeader] = field;
      }
    });

    return mapping;
  };

  const parseCSV = (csvText: string): ParsedCustomer[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must have at least a header and one data row');

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const detectedMapping = detectFieldMapping(headers);
    setFieldMapping(detectedMapping);

    const customers: ParsedCustomer[] = [];
    const importErrors: ImportError[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const customer: ParsedCustomer = { email: '' };

      headers.forEach((header, index) => {
        const mappedField = detectedMapping[header];
        const value = values[index]?.trim();

        if (!value) return;

        switch (mappedField) {
          case 'email':
            if (!/\S+@\S+\.\S+/.test(value)) {
              importErrors.push({
                row: i + 1,
                field: 'email',
                message: 'Invalid email format',
                data: { email: value }
              });
            } else {
              customer.email = value.toLowerCase();
            }
            break;
          case 'first_name':
            customer.first_name = value;
            break;
          case 'last_name':
            customer.last_name = value;
            break;
          case 'phone':
            customer.phone = value.replace(/\D/g, ''); // Remove non-digits
            break;
          case 'persona':
            // Normalize persona to match database constraints
            const normalizedPersona = value.toLowerCase();
            const allowedPersonas = ['newbie', 'struggler', 'regular', 'expert'];
            if (allowedPersonas.includes(normalizedPersona)) {
              customer.persona = normalizedPersona;
            } else {
              // Map common variations to allowed values
              const personaMapping: Record<string, string> = {
                'new-customer': 'newbie',
                'new': 'newbie',
                'beginner': 'newbie',
                'loyal-customer': 'regular',
                'loyal': 'regular',
                'experienced': 'expert',
                'advanced': 'expert',
                'seasonal-shopper': 'regular',
                'high-value': 'expert'
              };
              customer.persona = personaMapping[normalizedPersona] || null;
            }
            break;
          case 'tags':
            customer.tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
            break;
          case 'lifetime_value':
            const ltv = parseFloat(value);
            if (!isNaN(ltv)) customer.lifetime_value = ltv;
            break;
          case 'last_purchase_date':
            customer.last_purchase_date = value;
            break;
          case 'sms_opt_in':
            customer.sms_opt_in = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
            break;
          case 'name':
            // Split name into first and last
            const nameParts = value.split(' ');
            if (nameParts.length >= 2) {
              customer.first_name = nameParts[0];
              customer.last_name = nameParts.slice(1).join(' ');
            } else {
              customer.first_name = value;
            }
            break;
        }
      });

      if (!customer.email) {
        importErrors.push({
          row: i + 1,
          field: 'email',
          message: 'Email is required',
          data: customer
        });
      } else {
        customers.push(customer);
      }
    }

    setErrors(importErrors);
    return customers;
  };

  const parseExcel = (file: File): Promise<ParsedCustomer[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          resolve(parseCSV(csvText));
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFile(file);
    setIsProcessing(true);

    try {
      let customers: ParsedCustomer[];
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        customers = parseCSV(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        customers = await parseExcel(file);
      } else {
        throw new Error('Unsupported file format. Please use CSV or Excel files.');
      }

      setParsedData(customers);
      setShowPreview(true);
      
      toast({
        title: "File parsed successfully",
        description: `Found ${customers.length} valid customers with ${errors.length} errors`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Error parsing file",
        description: error instanceof Error ? error.message : "Failed to parse file",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [errors.length, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleImport = async () => {
    if (!parsedData.length) return;

    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('User tenant not found');

      // Check for existing customers
      const emails = parsedData.map(c => c.email);
      const { data: existingCustomers } = await supabase
        .from('crm_customers')
        .select('email')
        .eq('tenant_id', userRecord.tenant_id)
        .in('email', emails);

      const existingEmails = new Set(existingCustomers?.map(c => c.email) || []);
      
      let customersToInsert = parsedData.map(customer => ({
        ...customer,
        tenant_id: userRecord.tenant_id,
        user_id: user.user.id,
        persona: customer.persona || defaultPersona || null,
        pos_source: 'import'
      }));

      if (!updateExisting) {
        customersToInsert = customersToInsert.filter(c => !existingEmails.has(c.email));
      }

      const { error } = await supabase
        .from('crm_customers')
        .upsert(customersToInsert, {
          onConflict: 'email,tenant_id',
          ignoreDuplicates: !updateExisting
        });

      if (error) throw error;

      const importedCount = customersToInsert.length;
      const skippedCount = parsedData.length - importedCount;

      toast({
        title: "Import completed",
        description: `Imported ${importedCount} customers${skippedCount ? `, skipped ${skippedCount} duplicates` : ''}`,
        duration: 5000,
      });

      resetForm();
      onImportComplete?.();
    } catch (error) {
      console.error('Error importing customers:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import customers",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setShowPreview(false);
    setFieldMapping({});
    setIsOpen(false);
  };

  const downloadTemplate = () => {
    const template = `email,first_name,last_name,phone,persona,tags,lifetime_value,last_purchase_date,sms_opt_in
john@example.com,John,Doe,5551234567,regular,"gardening,tools",250.50,2024-01-15,true
jane@example.com,Jane,Smith,5559876543,newbie,"plants,seeds",75.25,2024-01-10,false`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import Customers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Customer List</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Download our CSV template to ensure your data is formatted correctly for import.
              </p>
              <Button onClick={downloadTemplate} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Customer File</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p>Drop your customer file here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Drag & drop your customer file here, or click to browse
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports CSV, Excel (.xlsx, .xls) files up to 10MB
                    </p>
                  </div>
                )}
              </div>
              {file && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Options */}
          {parsedData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="update-existing" 
                    checked={updateExisting}
                    onCheckedChange={(checked) => setUpdateExisting(checked === true)}
                  />
                  <Label htmlFor="update-existing">Update existing customers</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="append-tags" 
                    checked={appendTags}
                    onCheckedChange={(checked) => setAppendTags(checked === true)}
                  />
                  <Label htmlFor="append-tags">Append tags to existing customers</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-persona">Default persona for all customers</Label>
                  <NativeSelect
                    value={defaultPersona}
                    onChange={(e) => setDefaultPersona(e.target.value)}
                    placeholder="Select a persona (optional)"
                    options={[
                      { value: 'newbie', label: 'Newbie' },
                      { value: 'struggler', label: 'Struggler' },
                      { value: 'regular', label: 'Regular' },
                      { value: 'expert', label: 'Expert' }
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {errors.length > 0 ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  Import Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">✓ {parsedData.length} valid customers</span>
                    {errors.length > 0 && (
                      <span className="text-destructive">✗ {errors.length} errors</span>
                    )}
                  </div>

                  {/* Error Summary */}
                  {errors.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                      <h4 className="font-medium text-destructive mb-2">Import Errors:</h4>
                      <div className="space-y-1 text-sm">
                        {errors.slice(0, 5).map((error, index) => (
                          <div key={index}>
                            Row {error.row}: {error.message} ({error.field})
                          </div>
                        ))}
                        {errors.length > 5 && (
                          <div className="text-muted-foreground">
                            ...and {errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Data Preview */}
                  <div className="border rounded-md overflow-hidden">
                    <div className="bg-muted p-2 text-sm font-medium">
                      First 5 customers preview:
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Phone</th>
                            <th className="text-left p-2">Persona</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.slice(0, 5).map((customer, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{customer.email}</td>
                              <td className="p-2">
                                {[customer.first_name, customer.last_name].filter(Boolean).join(' ')}
                              </td>
                              <td className="p-2">{customer.phone || '-'}</td>
                              <td className="p-2">{customer.persona || defaultPersona || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!parsedData.length || isProcessing}
            >
              {isProcessing ? 'Importing...' : `Import ${parsedData.length} Customers`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};