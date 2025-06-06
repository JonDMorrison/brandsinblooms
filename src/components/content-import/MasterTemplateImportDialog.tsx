
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, Database, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface MasterTemplateImportDialogProps {
  onImportComplete?: () => void;
}

interface ParsedMasterTemplate {
  week_number: number;
  title: string;
  theme?: string;
  prompt?: string;
  seasonal_focus?: string;
  content_ideas?: string;
  target_audience_notes?: string;
  platform_specific_notes?: any;
}

export const MasterTemplateImportDialog = ({ onImportComplete }: MasterTemplateImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMasterTemplate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const parseCSV = (csvText: string): ParsedMasterTemplate[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const data: ParsedMasterTemplate[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length >= 2) {
        const weekNumber = parseInt(values[headers.indexOf('week_number')] || values[0]);
        const title = values[headers.indexOf('title')] || values[1];
        const theme = values[headers.indexOf('theme')] || values[2] || '';
        const prompt = values[headers.indexOf('prompt')] || values[3] || '';
        const seasonalFocus = values[headers.indexOf('seasonal_focus')] || values[4] || '';
        const contentIdeas = values[headers.indexOf('content_ideas')] || values[5] || '';
        const targetAudienceNotes = values[headers.indexOf('target_audience_notes')] || values[6] || '';
        
        if (!isNaN(weekNumber) && title) {
          data.push({
            week_number: weekNumber,
            title,
            theme,
            prompt,
            seasonal_focus: seasonalFocus,
            content_ideas: contentIdeas,
            target_audience_notes: targetAudienceNotes
          });
        }
      }
    }
    
    return data;
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
        .from('master_campaign_templates')
        .insert(parsedData)
        .select();

      if (error) {
        throw error;
      }

      toast.success(`Successfully imported ${data.length} master templates`);
      setOpen(false);
      setFile(null);
      setParsedData([]);
      setPreviewMode(false);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Failed to import templates: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyToCampaigns = async () => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.rpc('copy_master_templates_to_campaigns');

      if (error) {
        throw error;
      }

      toast.success(`Successfully created ${data} campaigns from master templates`);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Copy error:', error);
      toast.error(`Failed to copy templates: ${error.message}`);
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
        <Button variant="outline" className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
          <Database className="h-4 w-4" />
          Master Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Master Campaign Templates</DialogTitle>
        </DialogHeader>
        
        {!previewMode ? (
          <div className="space-y-6">
            <div className="flex gap-3">
              <Button 
                onClick={handleCopyToCampaigns}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Copy className="h-4 w-4" />
                {isProcessing ? "Copying..." : "Copy Templates to Campaigns"}
              </Button>
            </div>
            
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium">Import New Master Templates</h3>
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
                  <p><strong>Required columns:</strong> week_number, title</p>
                  <p><strong>Optional columns:</strong> theme, prompt, seasonal_focus, content_ideas, target_audience_notes</p>
                  <p><strong>Example:</strong></p>
                  <code className="bg-white px-2 py-1 rounded text-xs block mt-1">
                    week_number,title,theme,prompt,seasonal_focus,content_ideas<br/>
                    1,"New Year Fresh Start","Goal Setting","Focus on new beginnings and resolutions","Winter/New Year","Goal-setting content, before/after posts, motivation quotes"
                  </code>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Preview: {parsedData.length} master templates found
              </h4>
              <Button variant="outline" size="sm" onClick={resetForm}>
                Choose Different File
              </Button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              <div className="space-y-2 p-2">
                {parsedData.map((template, index) => (
                  <div key={index} className="border rounded p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium">{template.title}</h5>
                      <Badge variant="secondary">Week {template.week_number}</Badge>
                    </div>
                    {template.theme && (
                      <p className="text-sm text-gray-600 mb-1"><strong>Theme:</strong> {template.theme}</p>
                    )}
                    {template.prompt && (
                      <p className="text-sm text-gray-600 mb-1"><strong>Prompt:</strong> {template.prompt}</p>
                    )}
                    {template.seasonal_focus && (
                      <p className="text-sm text-gray-600 mb-1"><strong>Seasonal Focus:</strong> {template.seasonal_focus}</p>
                    )}
                    {template.content_ideas && (
                      <p className="text-sm text-gray-600"><strong>Content Ideas:</strong> {template.content_ideas}</p>
                    )}
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? "Importing..." : `Import ${parsedData.length} Templates`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
