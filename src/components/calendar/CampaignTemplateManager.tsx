
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Copy, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface CampaignTemplate {
  id: string;
  title: string;
  theme: string;
  description: string;
  category: string;
  created_at: string;
}

interface Campaign {
  id: number;
  title: string;
  theme?: string;
  description?: string;
}

interface CampaignTemplateManagerProps {
  onTemplateApply: (template: CampaignTemplate) => void;
  selectedCampaign?: Campaign;
}

export const CampaignTemplateManager = ({ onTemplateApply, selectedCampaign }: CampaignTemplateManagerProps) => {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    category: "",
    description: ""
  });

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      // For now, we'll use local storage since we don't have a templates table
      const saved = localStorage.getItem('campaign_templates');
      if (saved) {
        setTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const saveTemplate = () => {
    if (!selectedCampaign || !newTemplate.title.trim()) return;

    const template: CampaignTemplate = {
      id: Date.now().toString(),
      title: newTemplate.title,
      theme: selectedCampaign.theme || "",
      description: newTemplate.description || selectedCampaign.description || "",
      category: newTemplate.category || "General",
      created_at: new Date().toISOString()
    };

    const existing = JSON.parse(localStorage.getItem('campaign_templates') || '[]');
    const updated = [...existing, template];
    localStorage.setItem('campaign_templates', JSON.stringify(updated));
    
    setTemplates(updated);
    setNewTemplate({ title: "", category: "", description: "" });
    setIsSaveOpen(false);
    toast.success('Campaign saved as template');
  };

  const applyTemplate = (template: CampaignTemplate) => {
    onTemplateApply(template);
    setIsOpen(false);
    toast.success(`Applied template: ${template.title}`);
  };

  const deleteTemplate = (templateId: string) => {
    const updated = templates.filter(t => t.id !== templateId);
    setTemplates(updated);
    localStorage.setItem('campaign_templates', JSON.stringify(updated));
    toast.success('Template deleted');
  };

  const groupedTemplates = templates.reduce((groups, template) => {
    const category = template.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(template);
    return groups;
  }, {} as Record<string, CampaignTemplate[]>);

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <BookOpen className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Templates</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Badge variant="outline">{category}</Badge>
                  <span className="text-sm text-gray-500">
                    {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {categoryTemplates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{template.title}</h4>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => applyTemplate(template)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTemplate(template.id)}
                            className="h-6 w-6 p-0 text-red-500"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Theme:</strong> {template.theme}
                      </div>
                      
                      {template.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      
                      <div className="text-xs text-gray-400 mt-2">
                        Created: {new Date(template.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No templates saved yet</p>
                <p className="text-sm">Save successful campaigns as templates for reuse</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedCampaign && (
        <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Star className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Campaign as Template</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                  placeholder="e.g., Spring Promotion Campaign"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  placeholder="e.g., Seasonal, Product Launch, Educational"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Describe when and how to use this template..."
                  rows={3}
                />
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  <strong>Current Campaign:</strong> {selectedCampaign.title}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Theme:</strong> {selectedCampaign.theme || 'No theme set'}
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTemplate} disabled={!newTemplate.title.trim()}>
                  Save Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
