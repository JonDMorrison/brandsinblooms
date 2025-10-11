import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { parseCSVFile, isValidEmail, generateCSVTemplate } from '@/utils/csvParser';
import type { ColumnMapping, ValidationResult, ImportResult, ImportProgress, DatabaseField, AIAnalysisResult } from '@/types/import';

interface EnhancedSegmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId?: string;
  segmentName?: string;
  onImportComplete?: () => void;
}

export const EnhancedSegmentImportDialog: React.FC<EnhancedSegmentImportDialogProps> = ({
  open,
  onOpenChange,
  segmentId,
  segmentName,
  onImportComplete
}) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [progress, setProgress] = useState<ImportProgress>({
    stage: 'upload',
    progress: 0,
    message: ''
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);

  const fieldOptions = [
    { value: 'skip', label: '-- Skip Column --' },
    { value: 'email', label: 'Email (Required)' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'tags', label: 'Tags (comma-separated)' },
    { value: 'persona', label: 'Persona' },
    { value: 'sms_opt_in', label: 'SMS Opt-In (yes/no)' }
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Only validate file type, no size or format restrictions
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    setProgress({ stage: 'upload', progress: 30, message: 'Parsing CSV file...' });

    try {
      // Step 1: Parse CSV
      const parsed = await parseCSVFile(selectedFile);
      
      setProgress({ 
        stage: 'upload', 
        progress: 50, 
        message: 'Analyzing data with AI...' 
      });
      setIsAnalyzing(true);

      // Step 2: Call AI analysis
      console.log('🤖 Calling AI analysis with data:', {
        rowCount: parsed.firstFiveRows?.length,
        delimiter: parsed.delimiter,
        columnCount: parsed.columnCount
      });

      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'analyze-csv-intelligent',
        {
          body: {
            csvRows: parsed.firstFiveRows,
            delimiter: parsed.delimiter,
            columnCount: parsed.columnCount
          }
        }
      );

      console.log('🤖 AI analysis response:', { analysisResult, analysisError });
      setIsAnalyzing(false);

      // Step 3: Handle AI response
      let mappings: ColumnMapping[];
      
      if (analysisError || !analysisResult?.success) {
        console.error('❌ AI analysis failed:', {
          error: analysisError,
          result: analysisResult,
          errorMessage: analysisError?.message,
          resultError: analysisResult?.error
        });
        toast({
          title: 'AI analysis unavailable',
          description: analysisError?.message || analysisResult?.error || 'Using basic column detection. You can manually adjust mappings.',
          variant: 'destructive'
        });
        
        // Fallback: Use generic column names
        mappings = parsed.headers.map((header, index) => ({
          csvHeader: header,
          databaseField: 'skip' as DatabaseField,
          sampleData: parsed.sampleData[index].samples
        }));
      } else {
        // Success: Use AI suggestions
        setAiAnalysis(analysisResult);
        
        mappings = analysisResult.analysis.suggestedMappings.map((suggestion) => ({
          csvHeader: suggestion.columnName,
          databaseField: suggestion.suggestedField,
          sampleData: parsed.firstFiveRows.map(row => row[suggestion.columnIndex] || ''),
          aiConfidence: suggestion.confidence,
          aiReasoning: suggestion.reasoning
        }));
        
        // Show warnings if data is inconsistent
        if (!analysisResult.analysis.dataConsistency.isConsistent) {
          setValidationErrors(analysisResult.analysis.dataConsistency.issues);
        }
        
        toast({
          title: 'CSV analyzed successfully',
          description: `AI detected ${mappings.length} columns with ${
            analysisResult.analysis.dataConsistency.isConsistent ? 'consistent' : 'some inconsistent'
          } data`
        });
      }

      setColumnMappings(mappings);
      setDataRows(parsed.dataRows);
      
      setProgress({ 
        stage: 'mapping', 
        progress: 0, 
        message: `Loaded ${parsed.dataRows.length} rows. ${aiAnalysis ? 'AI analysis complete.' : 'Please verify mappings.'}` 
      });

    } catch (error) {
      console.error('Error analyzing CSV:', error);
      setIsAnalyzing(false);
      toast({
        title: 'Error processing CSV',
        description: error instanceof Error ? error.message : 'Failed to process CSV file',
        variant: 'destructive'
      });
      setFile(null);
      setProgress({ stage: 'upload', progress: 0, message: '' });
    }
  };

  const handleFieldMappingChange = (index: number, value: string) => {
    setColumnMappings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], databaseField: value as DatabaseField };
      return updated;
    });
    setValidationErrors([]);
  };

  const validateMappings = (): ValidationResult => {
    const errors: string[] = [];
    
    // Check if email is mapped
    const hasEmail = columnMappings.some(m => m.databaseField === 'email');
    if (!hasEmail) {
      errors.push('Email field is required. Please map at least one column to Email.');
    }
    
    // Check for duplicate mappings (excluding skip)
    const nonSkipFields = columnMappings
      .filter(m => m.databaseField !== 'skip')
      .map(m => m.databaseField);
    
    const duplicates = nonSkipFields.filter((field, index) => 
      nonSkipFields.indexOf(field) !== index
    );
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate mappings found for: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const processImport = async (): Promise<ImportResult> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('User not authenticated');

    const { data: userRecord } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.user.id)
      .single();

    if (!userRecord?.tenant_id) {
      throw new Error('You are not assigned to a tenant');
    }

    // Transform rows to customer objects
    const customers = dataRows.map(row => {
      const customer: any = {
        tenant_id: userRecord.tenant_id,
        user_id: user.user.id,
        email_opt_in: false,
        email_consent_source: 'csv_import',
        email_consent_method: 'pending_confirmation'
      };
      
      columnMappings.forEach((mapping, index) => {
        if (mapping.databaseField === 'skip') return;
        
        const value = row[index]?.trim();
        if (!value) return;
        
        switch (mapping.databaseField) {
          case 'email':
            customer.email = value.toLowerCase();
            break;
          case 'first_name':
            customer.first_name = value;
            break;
          case 'last_name':
            customer.last_name = value;
            break;
          case 'phone':
            customer.phone = value.replace(/\D/g, '');
            break;
          case 'tags':
            customer.tags = value.split(',').map(t => t.trim()).filter(Boolean);
            break;
          case 'persona':
            customer.persona = value;
            break;
          case 'sms_opt_in':
            customer.sms_opt_in = ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
            break;
        }
      });
      
      return customer;
    });

    // Filter valid customers
    const validCustomers = customers.filter(c => c.email && isValidEmail(c.email));
    const skipped = customers.length - validCustomers.length;

    // Insert customers in batches
    const BATCH_SIZE = 500;
    const totalBatches = Math.ceil(validCustomers.length / BATCH_SIZE);
    const results: ImportResult = {
      total: customers.length,
      imported: 0,
      failed: 0,
      skipped,
      errors: []
    };

    for (let i = 0; i < validCustomers.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = validCustomers.slice(i, i + BATCH_SIZE);
      
      setProgress({
        stage: 'importing',
        progress: (batchNumber / totalBatches) * 100,
        message: `Importing batch ${batchNumber} of ${totalBatches}...`,
        currentBatch: batchNumber,
        totalBatches
      });

      try {
        const { data, error } = await supabase
          .from('crm_customers')
          .upsert(batch, {
            onConflict: 'email,tenant_id',
            ignoreDuplicates: false
          })
          .select('id');
        
        if (error) throw error;
        
        results.imported += data.length;
        
        // If segment is specified, add customers to segment
        if (segmentId && data) {
          const segmentAssignments = data.map(customer => ({
            customer_id: customer.id,
            segment_id: segmentId,
            assigned_by_user_id: user.user.id
          }));
          
          await supabase
            .from('customer_segments')
            .upsert(segmentAssignments, {
              onConflict: 'customer_id,segment_id'
            });
        }
      } catch (error) {
        console.error('Batch import error:', error);
        results.failed += batch.length;
        results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    return results;
  };

  const handleImport = async () => {
    // Validate mappings
    const validation = validateMappings();
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast({
        title: 'Invalid field mapping',
        description: validation.errors[0],
        variant: 'destructive'
      });
      return;
    }

    setProgress({ 
      stage: 'importing', 
      progress: 0, 
      message: 'Starting import...' 
    });

    try {
      const result = await processImport();
      
      setImportResult(result);
      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Import completed'
      });

      toast({
        title: 'Import completed',
        description: `Successfully imported ${result.imported} customers${result.failed > 0 ? `, ${result.failed} failed` : ''}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`
      });

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import customers',
        variant: 'destructive'
      });
      setProgress({ stage: 'mapping', progress: 0, message: '' });
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateCSVTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    if (progress.stage === 'importing') {
      toast({
        title: 'Import in progress',
        description: 'Please wait for the import to complete',
        variant: 'destructive'
      });
      return;
    }
    
    // Reset state
    setFile(null);
    setColumnMappings([]);
    setDataRows([]);
    setProgress({ stage: 'upload', progress: 0, message: '' });
    setImportResult(null);
    setValidationErrors([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Import Customers {segmentName && `to "${segmentName}"`}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file and map the columns to customer fields
          </DialogDescription>
        </DialogHeader>

        {/* Stage 1: File Upload */}
        {progress.stage === 'upload' && (
          <div className="space-y-6">
            {/* Download Template Section */}
            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Download Template</h3>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Download our CSV template to ensure your data is formatted correctly for import.
              </p>
              
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </Button>
            </div>

            {/* Upload File Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Upload Customer File</h3>
              
              <div 
                className="border-2 border-dashed rounded-lg p-12 text-center transition-colors hover:border-primary/50 cursor-pointer"
                onClick={() => document.getElementById('csv-upload')?.click()}
              >
                <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <p className="text-base font-medium text-foreground mb-2">
                  Drag & drop your customer file here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports CSV files with any delimiter
                </p>
                
                {file && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-md inline-block">
                    <p className="text-sm font-medium text-primary">
                      Selected: {file.name}
                    </p>
                  </div>
                )}
                
                {isAnalyzing && (
                  <div className="mt-6 flex flex-col items-center gap-3 p-6 bg-muted/30 rounded-lg">
                    <LoadingSpinner 
                      size="md" 
                      color="primary"
                    />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Analyzing file with AI
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This should only take a few seconds
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: Field Mapping */}
        {progress.stage === 'mapping' && columnMappings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {dataRows.length} rows found. Map CSV columns to database fields:
              </p>
              <Button variant="outline" size="sm" onClick={() => {
                setFile(null);
                setColumnMappings([]);
                setDataRows([]);
                setProgress({ stage: 'upload', progress: 0, message: '' });
                setAiAnalysis(null);
              }}>
                Change File
              </Button>
            </div>

            {aiAnalysis && !aiAnalysis.analysis.dataConsistency.isConsistent && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Data Consistency Issues Detected:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {aiAnalysis.analysis.dataConsistency.issues.map((issue, idx) => (
                      <li key={idx} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                  <p className="text-sm mt-2">Please review the mappings carefully before importing.</p>
                </AlertDescription>
              </Alert>
            )}

            {validationErrors.length > 0 && !aiAnalysis && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">CSV Column</TableHead>
                    <TableHead className="w-[300px]">Sample Data (5 rows)</TableHead>
                    <TableHead className="w-[200px]">Map To Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{mapping.csvHeader}</span>
                          {mapping.aiConfidence && (
                            <span 
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                mapping.aiConfidence === 'high' 
                                  ? 'bg-primary/10 text-primary' 
                                  : mapping.aiConfidence === 'medium' 
                                  ? 'bg-secondary/30 text-secondary-foreground' 
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {mapping.aiConfidence}
                            </span>
                          )}
                        </div>
                        {mapping.aiReasoning && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {mapping.aiReasoning}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm text-muted-foreground max-h-32 overflow-y-auto">
                          {mapping.sampleData.map((sample, idx) => (
                            <div key={idx} className="truncate max-w-xs" title={sample}>
                              {sample || <span className="italic text-muted-foreground/50">empty</span>}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          value={mapping.databaseField}
                          onChange={(e) => handleFieldMappingChange(index, e.target.value)}
                          options={fieldOptions}
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {dataRows.length} Customers
              </Button>
            </div>
          </div>
        )}

        {/* Stage 3: Importing */}
        {progress.stage === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-lg font-medium">{progress.message}</p>
            </div>
            <Progress value={progress.progress} className="w-full" />
            {progress.currentBatch && progress.totalBatches && (
              <p className="text-center text-sm text-muted-foreground">
                Processing batch {progress.currentBatch} of {progress.totalBatches}
              </p>
            )}
          </div>
        )}

        {/* Stage 4: Complete */}
        {progress.stage === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{importResult.total}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Successfully Imported</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                  {importResult.imported}
                </p>
              </div>
              {importResult.skipped > 0 && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Skipped (invalid email)</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                    {importResult.skipped}
                  </p>
                </div>
              )}
              {importResult.failed > 0 && (
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                    {importResult.failed}
                  </p>
                </div>
              )}
            </div>

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-semibold mb-2">Errors occurred during import:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {importResult.errors.slice(0, 5).map((error, i) => (
                      <li key={i} className="text-sm">{error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li className="text-sm italic">
                        ...and {importResult.errors.length - 5} more errors
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
