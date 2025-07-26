import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  X, 
  FileText,
  Users,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  tags?: string;
  persona?: string;
  sms_opt_in?: string;
  [key: string]: string | undefined;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: string;
}

interface ImportResult {
  success: number;
  errors: number;
  skipped: number;
  validationErrors: ValidationError[];
}

const expectedColumns = [
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'tags', label: 'Tags (comma separated)', required: false },
  { key: 'persona', label: 'Persona', required: false },
  { key: 'sms_opt_in', label: 'SMS Opt-in (true/false)', required: false },
];

const validPersonas = ['newbie', 'struggler', 'regular', 'expert'];

export const CustomerImportModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'importing' | 'results'>('upload');
  const [fileData, setFileData] = useState<ImportData[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validRows, setValidRows] = useState<ImportData[]>([]);
  const [skipErrors, setSkipErrors] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const resetModal = () => {
    setStep('upload');
    setFileData([]);
    setFileName('');
    setColumnMapping({});
    setValidationErrors([]);
    setValidRows([]);
    setImportProgress(0);
    setImportResult(null);
    setShowAISuggestions(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
      
      if (jsonData.length < 2) {
        toast({
          title: "Invalid file",
          description: "File must contain header row and at least one data row",
          variant: "destructive"
        });
        return;
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1);
      
      const parsedData: ImportData[] = rows.map(row => {
        const obj: ImportData = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      setFileData(parsedData);
      
      // Auto-map columns
      const autoMapping: Record<string, string> = {};
      expectedColumns.forEach(col => {
        const matchedHeader = headers.find(h => 
          h.toLowerCase().includes(col.key.replace('_', ' ').toLowerCase()) ||
          h.toLowerCase().includes(col.key.toLowerCase())
        );
        if (matchedHeader) {
          autoMapping[col.key] = matchedHeader;
        }
      });
      
      setColumnMapping(autoMapping);
      setStep('mapping');
      
    } catch (error) {
      toast({
        title: "Error reading file",
        description: "Please ensure the file is a valid CSV or Excel file",
        variant: "destructive"
      });
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const formatPhone = (phone: string): string => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if US number (10 digits)
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Return as-is if already has country code
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    return phone; // Return original if can't format
  };

  const validateData = () => {
    const errors: ValidationError[] = [];
    const valid: ImportData[] = [];
    
    fileData.forEach((row, index) => {
      const mappedRow: ImportData = {};
      let hasError = false;
      
      // Map columns according to user mapping
      Object.entries(columnMapping).forEach(([expectedCol, actualCol]) => {
        if (actualCol && row[actualCol] !== undefined) {
          mappedRow[expectedCol] = row[actualCol];
        }
      });
      
      // Validate email
      if (mappedRow.email && !validateEmail(mappedRow.email)) {
        errors.push({
          row: index + 2, // +2 because of header and 0-index
          column: 'email',
          message: 'Invalid email format',
          value: mappedRow.email
        });
        hasError = true;
      }
      
      // Validate phone
      if (mappedRow.phone) {
        const formattedPhone = formatPhone(mappedRow.phone);
        if (formattedPhone === mappedRow.phone && !formattedPhone.startsWith('+')) {
          errors.push({
            row: index + 2,
            column: 'phone',
            message: 'Invalid phone format - should be E.164 format (+15554443333)',
            value: mappedRow.phone
          });
          hasError = true;
        } else {
          mappedRow.phone = formattedPhone;
        }
      }
      
      // Validate persona
      if (mappedRow.persona && !validPersonas.includes(mappedRow.persona.toLowerCase())) {
        errors.push({
          row: index + 2,
          column: 'persona',
          message: `Invalid persona - must be one of: ${validPersonas.join(', ')}`,
          value: mappedRow.persona
        });
        hasError = true;
      } else if (mappedRow.persona) {
        mappedRow.persona = mappedRow.persona.toLowerCase();
      }
      
      // Validate SMS opt-in
      if (mappedRow.sms_opt_in && !['true', 'false', ''].includes(mappedRow.sms_opt_in.toLowerCase())) {
        errors.push({
          row: index + 2,
          column: 'sms_opt_in',
          message: 'SMS opt-in must be true, false, or blank',
          value: mappedRow.sms_opt_in
        });
        hasError = true;
      } else if (mappedRow.sms_opt_in) {
        mappedRow.sms_opt_in = mappedRow.sms_opt_in.toLowerCase();
      }
      
      // Clean tags
      if (mappedRow.tags) {
        mappedRow.tags = mappedRow.tags
          .split(',')
          .map(tag => tag.trim().toLowerCase())
          .filter(tag => tag.length > 0)
          .join(',');
      }
      
      // Check if row has at least email or phone
      if (!mappedRow.email && !mappedRow.phone) {
        errors.push({
          row: index + 2,
          column: 'email/phone',
          message: 'Must have either email or phone number',
          value: 'Missing both'
        });
        hasError = true;
      }
      
      if (!hasError || !skipErrors) {
        valid.push(mappedRow);
      }
    });
    
    setValidationErrors(errors);
    setValidRows(valid);
    setStep('validation');
  };

  const performImport = async () => {
    if (!user) return;
    
    setStep('importing');
    setImportProgress(0);
    
    const batchSize = 50;
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      
      try {
        // Get user's tenant_id
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        
        const customersData = batch.map(row => ({
          email: row.email || `placeholder-${Date.now()}-${Math.random()}@example.com`,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          phone: row.phone || null,
          persona: row.persona || null,
          tags: row.tags ? row.tags.split(',') : null,
          sms_opt_in: row.sms_opt_in === 'true',
          sms_opt_in_at: row.sms_opt_in === 'true' ? new Date().toISOString() : null,
          pos_source: 'manual_import',
          tenant_id: userData?.tenant_id,
          user_id: user.id
        }));
        
        const { error } = await supabase
          .from('crm_customers')
          .insert(customersData);
        
        if (error) {
          console.error('Batch import error:', error);
          failed += batch.length;
        } else {
          imported += batch.length;
        }
      } catch (error) {
        console.error('Import batch failed:', error);
        failed += batch.length;
      }
      
      setImportProgress(Math.round(((i + batchSize) / validRows.length) * 100));
    }
    
    const result: ImportResult = {
      success: imported,
      errors: failed,
      skipped: validationErrors.length,
      validationErrors
    };
    
    setImportResult(result);
    setStep('results');
    
    toast({
      title: "Import completed",
      description: `${imported} customers imported successfully`,
    });
  };

  const downloadErrorReport = () => {
    const errorData = validationErrors.map(error => ({
      Row: error.row,
      Column: error.column,
      Error: error.message,
      Value: error.value
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(errorData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Errors');
    XLSX.writeFile(workbook, 'import-errors.xlsx');
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Upload Customer List</h3>
        <p className="text-muted-foreground mb-6">
          Upload a CSV or Excel file with your customer data
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Choose File
        </Button>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-medium">Expected Columns</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {expectedColumns.map(col => (
            <div key={col.key} className="flex justify-between">
              <span>{col.label}</span>
              <Badge variant={col.required ? "default" : "secondary"}>
                {col.required ? "Required" : "Optional"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Make sure your file has headers in the first row. We'll help you map them in the next step.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Map Your Columns</h3>
        <p className="text-muted-foreground">
          We've auto-detected some columns. Please verify the mapping below.
        </p>
      </div>
      
      <div className="space-y-4">
        {expectedColumns.map(col => (
          <div key={col.key} className="grid grid-cols-2 gap-4 items-center">
            <Label>{col.label}</Label>
            <Select 
              value={columnMapping[col.key] || ''} 
              onValueChange={(value) => setColumnMapping(prev => ({ ...prev, [col.key]: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Skip --</SelectItem>
                {Object.keys(fileData[0] || {}).map(header => (
                  <SelectItem key={header} value={header}>{header}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('upload')}>
          Back
        </Button>
        <Button onClick={validateData}>
          Validate Data
        </Button>
      </div>
    </div>
  );

  const renderValidationStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Validation Results</h3>
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-500">{validRows.length}</p>
              <p className="text-sm text-muted-foreground">Valid Rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-500">{validationErrors.length}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-500">{fileData.length}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {validationErrors.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-red-600">Validation Errors</h4>
            <Button variant="outline" size="sm" onClick={downloadErrorReport}>
              <Download className="h-4 w-4 mr-2" />
              Download Error Report
            </Button>
          </div>
          
          <div className="max-h-60 overflow-y-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validationErrors.slice(0, 50).map((error, index) => (
                  <TableRow key={index}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.column}</TableCell>
                    <TableCell className="text-red-600">{error.message}</TableCell>
                    <TableCell className="font-mono text-sm">{error.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch 
              id="skip-errors" 
              checked={skipErrors} 
              onCheckedChange={setSkipErrors}
            />
            <Label htmlFor="skip-errors">
              Skip rows with errors and import valid data only
            </Label>
          </div>
        </div>
      )}
      
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('mapping')}>
          Back
        </Button>
        <Button 
          onClick={performImport}
          disabled={validRows.length === 0}
        >
          Import {validRows.length} Customers
        </Button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
        <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
      <h3 className="text-lg font-semibold">Importing Customers...</h3>
      <Progress value={importProgress} className="w-full" />
      <p className="text-muted-foreground">{importProgress}% complete</p>
    </div>
  );

  const renderResultsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
      </div>
      
      {importResult && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
              <p className="text-sm text-muted-foreground">Imported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{importResult.skipped}</p>
              <p className="text-sm text-muted-foreground">Skipped</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{importResult.errors}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      <Separator />
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            AI Suggestions
          </h4>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAISuggestions(!showAISuggestions)}
          >
            {showAISuggestions ? 'Hide' : 'Show'}
          </Button>
        </div>
        
        {showAISuggestions && (
          <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="space-y-2">
              <h5 className="font-medium">Recommended Next Steps:</h5>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Create a segment for "New Import - {fileName}" to target these customers</li>
                <li>Set up a welcome email campaign for new customers</li>
                <li>Review customer personas and consider running persona auto-assignment</li>
                <li>Add SMS opt-in campaigns for customers without SMS consent</li>
              </ul>
            </div>
            
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Create Segment
              </Button>
              <Button size="sm" variant="outline">
                Create Welcome Campaign
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => {
            resetModal();
            setIsOpen(false);
          }}
        >
          Close
        </Button>
        <Button onClick={resetModal}>
          Import More
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Import Customers
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="customer-import-desc">
        <p id="customer-import-desc" className="sr-only">Import customers from a CSV file with mapping options for fields like name, email, phone, and gardening experience level.</p>
        <DialogHeader>
          <DialogTitle>Import Customer List</DialogTitle>
        </DialogHeader>
        
        <div className="mt-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'mapping' && renderMappingStep()}
          {step === 'validation' && renderValidationStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'results' && renderResultsStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};