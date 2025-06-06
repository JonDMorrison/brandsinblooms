
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Copy, Loader2, Calendar } from "lucide-react";

interface MasterTemplate {
  id: string;
  week_number: number;
  title: string;
  theme?: string;
  prompt?: string;
  seasonal_focus?: string;
  content_ideas?: string;
  target_audience_notes?: string;
  created_at: string;
}

export const MasterTemplateManager = () => {
  const [templates, setTemplates] = useState<MasterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number', { ascending: true });

      if (error) {
        console.error('Error fetching master templates:', error);
        toast.error('Failed to load master templates');
      } else {
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Error fetching master templates:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToCampaigns = async () => {
    setCopying(true);
    
    try {
      const { data, error } = await supabase.rpc('copy_master_templates_to_campaigns');

      if (error) {
        throw error;
      }

      toast.success(`Successfully created ${data} campaigns from master templates`);
    } catch (error: any) {
      console.error('Copy error:', error);
      toast.error(`Failed to copy templates: ${error.message}`);
    } finally {
      setCopying(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Master Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Master Templates ({templates.length})
          </CardTitle>
          {templates.length > 0 && (
            <Button 
              onClick={handleCopyToCampaigns}
              disabled={copying}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copying ? "Copying..." : "Copy to Campaigns"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium mb-2">No master templates found</p>
            <p className="text-sm">Import your master template CSV to get started</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-sm">{template.title}</h5>
                  <Badge variant="secondary" className="text-xs">
                    Week {template.week_number}
                  </Badge>
                </div>
                {template.theme && (
                  <p className="text-xs text-gray-600 mb-1">
                    <strong>Theme:</strong> {template.theme}
                  </p>
                )}
                {template.seasonal_focus && (
                  <p className="text-xs text-gray-600 mb-1">
                    <strong>Season:</strong> {template.seasonal_focus}
                  </p>
                )}
                {template.content_ideas && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    <strong>Ideas:</strong> {template.content_ideas}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
