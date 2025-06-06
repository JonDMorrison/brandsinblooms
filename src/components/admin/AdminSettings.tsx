
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Upload, FileText, Database, Trash2 } from "lucide-react";
import * as XLSX from 'xlsx';

interface AIResource {
  id: string;
  name: string;
  type: 'csv' | 'pdf' | 'text';
  content: string;
  description?: string;
  created_at: string;
}

export const AdminSettings = () => {
  const [resources, setResources] = useState<AIResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_generation_resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching AI resources:', error);
        toast.error('Failed to load AI resources');
      } else {
        setResources(data || []);
      }
    } catch (error) {
      console.error('Error fetching AI resources:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      let content = '';
      let fileType: 'csv' | 'pdf' | 'text' = 'text';

      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        fileType = 'csv';
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileType = 'csv';
        const data = new Uint8Array(await file.arrayBuffer());
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        content = XLSX.utils.sheet_to_csv(worksheet);
      } else if (file.name.endsWith('.pdf')) {
        fileType = 'pdf';
        // For PDF files, we'll store the base64 content
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      } else {
        toast.error('Unsupported file type. Please upload CSV, Excel, or PDF files.');
        setUploading(false);
        return;
      }

      const { data, error } = await supabase
        .from('ai_generation_resources')
        .insert([{
          name: file.name,
          type: fileType,
          content: content,
          description: `Uploaded ${fileType.toUpperCase()} file for AI generation guidance`
        }])
        .select();

      if (error) {
        throw error;
      }

      toast.success(`Successfully uploaded ${file.name}`);
      setResources(prev => [data[0], ...prev]);
      
      // Clear the input
      event.target.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('ai_generation_resources')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      toast.success(`Deleted ${name}`);
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete resource: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Master Admin Settings</h1>
        <Badge variant="destructive" className="ml-2">Admin Only</Badge>
      </div>

      <Tabs defaultValue="resources" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="resources">AI Resources</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload AI Generation Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resource-file">Upload CSV, Excel, or PDF File</Label>
                  <Input
                    id="resource-file"
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls,.pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Upload files containing content ideas, seasonal themes, or AI generation guidance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Current AI Resources ({resources.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p>Loading resources...</p>
                </div>
              ) : resources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium mb-2">No AI resources found</p>
                  <p className="text-sm">Upload your first resource file to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resources.map((resource) => (
                    <div key={resource.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="font-medium">{resource.name}</h5>
                            <Badge variant="outline">
                              {resource.type.toUpperCase()}
                            </Badge>
                          </div>
                          {resource.description && (
                            <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Uploaded: {new Date(resource.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteResource(resource.id, resource.name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Additional system settings and configurations will be added here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
