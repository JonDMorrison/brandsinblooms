
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement
import { Badge } from "@/components/ui/badge";

interface CsvUploadDialogProps {
  onImportComplete?: () => void;
}

interface ParsedCampaign {
  week_number: number;
  title: string;
  prompt: string;
  theme?: string;
  start_date: string;
}

export const CsvUploadDialog = ({ onImportComplete }: CsvUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCampaign[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const parseCSV = (csvText: string): ParsedCampaign[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Expected headers: week_number, title, prompt, theme (optional), start_date (optional)
    const data: ParsedCampaign[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length >= 3) {
        const weekNumber = parseInt(values[headers.indexOf('week_number')] || values[0]);
        const title = values[headers.indexOf('title')] || values[1];
        const prompt = values[headers.indexOf('prompt')] || values[2];
        const theme = values[headers.indexOf('theme')] || title;
        
        // Calculate start date based on week number if not provided
        const startDate = values[headers.indexOf('start_date')] || calculateStartDate(weekNumber);
        
        if (!isNaN(weekNumber) && title && prompt) {
          data.push({
            week_number: weekNumber,
            title,
            prompt,
            theme,
            start_date: startDate
          });
        }
      }
    }
    
    return data;
  };

  const calculateStartDate = (weekNumber: number): string => {
    const currentYear = new Date().getFullYear();
    const firstDayOfYear = new Date(currentYear, 0, 1);
    const daysToAdd = (weekNumber - 1) * 7;
    const startDate = new Date(firstDayOfYear.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return startDate.toISOString().split('T')[0];
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        try {
          const parsed = parseCSV(csvText);
          setParsedData(parsed);
          setPreviewMode(true);
        } catch (error) {
          toast.error('Failed to parse CSV file. Please check the format.');
          console.error('CSV parsing error:', error);
        }
      };
      reader.readAsText(selectedFile);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert(parsedData)
        .select();

      if (error) {
        throw error;
      }

      toast.success(`Successfully imported ${data.length} campaigns`);
      setOpen(false);
      setFile(null);
      setParsedData([]);
      setPreviewMode(false);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Failed to import campaigns: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setPreviewMode(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Campaigns from CSV</DialogTitle>
        </DialogHeader>
        
        {!previewMode ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Expected CSV Format
              </h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Required columns:</strong> week_number, title, prompt</p>
                <p><strong>Optional columns:</strong> theme, start_date</p>
                <p><strong>Example:</strong></p>
                <code className="bg-white px-2 py-1 rounded text-xs block mt-1">
                  week_number,title,prompt,theme<br/>
                  1,"Spring Prep","Focus on preparing gardens for spring planting season","Spring Preparation"
                </code>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Preview: {parsedData.length} campaigns found
              </h4>
              <Button variant="outline" size="sm" onClick={resetForm}>
                Choose Different File
              </Button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <div className="space-y-2 p-2">
                {parsedData.map((campaign, index) => (
                  <div key={index} className="border rounded p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium">{campaign.title}</h5>
                      <Badge variant="secondary">Week {campaign.week_number}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{campaign.prompt}</p>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span>Theme: {campaign.theme}</span>
                      <span>•</span>
                      <span>Start: {campaign.start_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? "Importing..." : `Import ${parsedData.length} Campaigns`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
