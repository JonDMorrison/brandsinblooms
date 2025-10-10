import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface SegmentImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (segments: Array<{ name: string; filters: any[] }>) => Promise<void>;
}

interface ParsedSegment {
  name: string;
  filters: any[];
  isValid: boolean;
  error?: string;
}

export const SegmentImportModal: React.FC<SegmentImportModalProps> = ({
  open,
  onClose,
  onImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedSegments, setParsedSegments] = useState<ParsedSegment[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    
    // Parse the CSV file
    try {
      const text = await selectedFile.text();
      const segments = parseCSV(text);
      setParsedSegments(segments);
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      console.error('CSV parsing error:', err);
    }
  };

  const parseCSV = (text: string): ParsedSegment[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Skip header row if it exists
    const dataLines = lines[0].toLowerCase().includes('name') ? lines.slice(1) : lines;
    
    return dataLines.map((line, index) => {
      try {
        // Simple CSV parsing - supports name only or name,description format
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        
        if (!parts[0]) {
          return {
            name: '',
            filters: [],
            isValid: false,
            error: 'Missing segment name'
          };
        }

        return {
          name: parts[0],
          filters: [], // Empty filters for mass import
          isValid: true
        };
      } catch (err) {
        return {
          name: `Row ${index + 1}`,
          filters: [],
          isValid: false,
          error: 'Invalid format'
        };
      }
    });
  };

  const handleImport = async () => {
    const validSegments = parsedSegments.filter(s => s.isValid);
    
    if (validSegments.length === 0) {
      toast({
        title: "No valid segments",
        description: "Please check your CSV file and try again",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      // Import segments in batches
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < validSegments.length; i += batchSize) {
        batches.push(validSegments.slice(i, i + batchSize));
      }

      for (let i = 0; i < batches.length; i++) {
        await onImport(batches[i]);
        setProgress(((i + 1) / batches.length) * 100);
      }

      toast({
        title: "Import successful",
        description: `Successfully imported ${validSegments.length} segment(s)`,
      });

      handleClose();
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: "Import failed",
        description: "Some segments could not be imported. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedSegments([]);
    setError(null);
    setProgress(0);
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = 'Segment Name\nVIP Customers\nNew Subscribers\nHigh Value Orders';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'segment-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedSegments.filter(s => s.isValid).length;
  const invalidCount = parsedSegments.filter(s => !s.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Segments
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple segments at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Need a template? Download our CSV template to get started.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="ml-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
            />
            
            {!file ? (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    Select CSV File
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    or drag and drop your file here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setParsedSegments([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={importing}
                >
                  Change File
                </Button>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {parsedSegments.length > 0 && !importing && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Preview ({validCount} valid, {invalidCount} invalid)
              </h4>
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {parsedSegments.slice(0, 10).map((segment, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 border-b last:border-b-0 ${
                      !segment.isValid ? 'bg-destructive/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {segment.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">{segment.name || 'Unnamed'}</span>
                    </div>
                    {segment.error && (
                      <span className="text-sm text-destructive">{segment.error}</span>
                    )}
                  </div>
                ))}
                {parsedSegments.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    And {parsedSegments.length - 10} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing segments...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || parsedSegments.length === 0 || validCount === 0 || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {validCount} Segment{validCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
