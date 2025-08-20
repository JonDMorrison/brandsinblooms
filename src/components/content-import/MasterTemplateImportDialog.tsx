import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, Database, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { getDateForWeek } from "@/utils/dateUtils";
import { useToast } from "@/hooks/use-toast";
// Removed sonner import - using global toast replacement
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';

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
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
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

  const parseExcel = (file: File): Promise<ParsedMasterTemplate[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject(new Error('File must contain at least a header row and one data row'));
            return;
          }
          
          const headers = (jsonData[0] as string[]).map(h => String(h).trim().toLowerCase());
          const templates: ParsedMasterTemplate[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row && row.length >= 2) {
              const weekNumber = parseInt(String(row[headers.indexOf('week_number')] || row[0] || ''));
              const title = String(row[headers.indexOf('title')] || row[1] || '');
              const theme = String(row[headers.indexOf('theme')] || row[2] || '');
              const prompt = String(row[headers.indexOf('prompt')] || row[3] || '');
              const seasonalFocus = String(row[headers.indexOf('seasonal_focus')] || row[4] || '');
              const contentIdeas = String(row[headers.indexOf('content_ideas')] || row[5] || '');
              const targetAudienceNotes = String(row[headers.indexOf('target_audience_notes')] || row[6] || '');
              
              if (!isNaN(weekNumber) && title && title !== 'undefined') {
                templates.push({
                  week_number: weekNumber,
                  title,
                  theme: theme === 'undefined' ? '' : theme,
                  prompt: prompt === 'undefined' ? '' : prompt,
                  seasonal_focus: seasonalFocus === 'undefined' ? '' : seasonalFocus,
                  content_ideas: contentIdeas === 'undefined' ? '' : contentIdeas,
                  target_audience_notes: targetAudienceNotes === 'undefined' ? '' : targetAudienceNotes
                });
              }
            }
          }
          
          resolve(templates);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      try {
        let parsed: ParsedMasterTemplate[] = [];
        
        if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
          parsed = await parseExcel(selectedFile);
        } else {
          // Handle CSV/TXT files
          const reader = new FileReader();
          const text = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(selectedFile);
          });
          parsed = parseCSV(text);
        }
        
        setParsedData(parsed);
        setPreviewMode(true);
        toast({
          title: "Success",
          description: `Found ${parsed.length} templates in your file`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse file. Please check the format.",
          variant: "destructive",
        });
        console.error('File parsing error:', error);
      }
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

      toast({
        title: "Success",
        description: `Successfully imported ${data.length} master templates`,
      });
      setOpen(false);
      setFile(null);
      setParsedData([]);
      setPreviewMode(false);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Error", 
        description: `Failed to import templates: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyToCampaigns = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please log in to copy templates",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('MasterTemplateImportDialog: Copying templates for user:', user.id, 'tenant:', tenant?.id || 'none');

      // Instead of using the existing RPC function, we'll manually copy templates with tenant awareness
      const { data: templates, error: fetchError } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number');

      if (fetchError) {
        throw fetchError;
      }

      if (!templates || templates.length === 0) {
        toast({
          title: "Error",
          description: "No master templates found to copy",
          variant: "destructive",
        });
        return;
      }

      // Prepare campaigns data with proper user/tenant assignment
      const campaignsToInsert = templates.map(template => ({
        week_number: template.week_number,
        title: template.title,
        theme: template.theme,
        prompt: template.prompt,
        description: template.content_ideas,
        start_date: getDateForWeek(template.week_number).toISOString().split('T')[0],
        user_id: tenant?.id ? null : user.id, // Set user_id only if not in tenant mode
        tenant_id: tenant?.id || null, // Set tenant_id if in tenant mode
        created_by_user_id: user.id // Always track who created it
      }));

      const { data: insertedCampaigns, error: insertError } = await supabase
        .from('campaigns')
        .insert(campaignsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      const createdCount = insertedCampaigns?.length || 0;
      console.log('MasterTemplateImportDialog: Successfully created', createdCount, 'campaigns');
      
      toast({
        title: "Success",
        description: `Successfully created ${createdCount} campaigns from master templates`,
      });
      onImportComplete?.();
    } catch (error: any) {
      console.error('Copy error:', error);
      toast({
        title: "Error",
        description: `Failed to copy templates: ${error.message}`,
        variant: "destructive",
      });
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
          <DialogTitle>
            Master Campaign Templates
            {tenant?.name && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                for {tenant.name}
              </span>
            )}
          </DialogTitle>
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
            
            {tenant?.id && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Tenant Mode:</strong> Templates will be copied for your organization ({tenant.name}) 
                  and will be accessible to all team members.
                </p>
              </div>
            )}
            
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium">Import New Master Templates</h3>
              <div className="space-y-2">
                <Label htmlFor="template-file">Upload File (.csv, .txt, .xlsx)</Label>
                <Input
                  id="template-file"
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  File Format Guide
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>Required columns:</strong> week_number, title</p>
                  <p><strong>Optional columns:</strong> theme, prompt, seasonal_focus, content_ideas, target_audience_notes</p>
                  <p><strong>Supported formats:</strong> CSV, TXT (comma-separated), Excel</p>
                  <p><strong>Example:</strong></p>
                  <code className="bg-white px-2 py-1 rounded text-xs block mt-1">
                    week_number,title,theme,prompt,seasonal_focus,content_ideas<br/>
                    1,"New Year Fresh Start","Goal Setting","Focus on new beginnings","Winter/New Year","Goal-setting content, motivation quotes"
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
