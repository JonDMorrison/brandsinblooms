import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCampaignTemplates, CampaignTemplate, SaveTemplateData } from '@/hooks/useCampaignTemplates';
import { ContentBlock } from '@/types/emailBuilder';
import { 
  Bookmark, 
  Plus, 
  Search, 
  Star, 
  Trash2, 
  Eye, 
  Copy,
  Filter,
  TrendingUp,
  Clock,
  Users
} from 'lucide-react';
import { toast } from '@/utils/toast';

interface CampaignTemplatesModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  currentCampaign?: {
    name: string;
    subject_line: string;
    content_blocks: ContentBlock[];
  };
  onApplyTemplate?: (template: CampaignTemplate) => void;
  onSaveAsTemplate?: (templateData: SaveTemplateData) => void;
  onTemplateSelect?: (template: any) => void;
}

export const CampaignTemplatesModal: React.FC<CampaignTemplatesModalProps> = ({
  trigger,
  open,
  onOpenChange,
  currentCampaign,
  onApplyTemplate,
  onSaveAsTemplate,
  onTemplateSelect
}) => {
  const { 
    templates, 
    loading, 
    saveAsTemplate, 
    useTemplate, 
    deleteTemplate,
    getTemplatesByCategory,
    getTopPerformingTemplates,
    searchTemplates
  } = useCampaignTemplates();

  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);
  const [activeTab, setActiveTab] = useState<'browse' | 'save'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showPreview, setShowPreview] = useState<string | null>(null);

  // Save template form state
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: '',
    tags: [] as string[],
    is_public: false
  });

  const categorizedTemplates = getTemplatesByCategory();
  const topTemplates = getTopPerformingTemplates();
  const filteredTemplates = searchTemplates(searchQuery, selectedCategory);

  const handleSaveTemplate = async () => {
    if (!currentCampaign) {
      toast.error('No campaign data to save as template');
      return;
    }

    if (!saveForm.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    const templateData: SaveTemplateData = {
      name: saveForm.name,
      description: saveForm.description,
      category: saveForm.category || 'General',
      content_blocks: currentCampaign.content_blocks,
      tags: saveForm.tags,
      is_public: saveForm.is_public
    };

    const result = await saveAsTemplate(templateData);
    if (result) {
      setSaveForm({
        name: '',
        description: '',
        category: '',
        tags: [],
        is_public: false
      });
      setActiveTab('browse');
      onSaveAsTemplate?.(templateData);
    }
  };

  const handleApplyTemplate = async (template: CampaignTemplate) => {
    await useTemplate(template.id);
    onApplyTemplate?.(template);
    onTemplateSelect?.(template);
    setIsOpen(false);
    onOpenChange?.(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate(templateId);
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      onOpenChange?.(open);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Bookmark className="h-4 w-4 mr-2" />
            Templates
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" aria-describedby="campaign-templates-desc">
        <p id="campaign-templates-desc" className="sr-only">Browse and select from available campaign templates to quickly create marketing campaigns for your garden center.</p>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Campaign Templates
          </DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Button
            variant={activeTab === 'browse' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('browse')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Browse Templates
          </Button>
          {currentCampaign && (
            <Button
              variant={activeTab === 'save' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('save')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'browse' && (
            <div className="space-y-4 h-full overflow-y-auto">
              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Top Performing Templates */}
              {topTemplates.length > 0 && !searchQuery && !selectedCategory && (
                <div>
                  <h3 className="font-medium flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4" />
                    Top Performing Templates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topTemplates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onApply={() => handleApplyTemplate(template)}
                        onDelete={() => handleDeleteTemplate(template.id)}
                        onPreview={() => setShowPreview(template.id)}
                        isTopPerforming
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Templates */}
              <div>
                <h3 className="font-medium flex items-center gap-2 mb-3">
                  <Bookmark className="h-4 w-4" />
                  All Templates ({filteredTemplates.length})
                </h3>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="font-medium mb-2">No templates found</h3>
                      <p className="text-muted-foreground text-sm">
                        {searchQuery || selectedCategory ? 
                          'Try adjusting your search or filters.' :
                          'Save your first campaign as a template to get started.'
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onApply={() => handleApplyTemplate(template)}
                        onDelete={() => handleDeleteTemplate(template.id)}
                        onPreview={() => setShowPreview(template.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'save' && currentCampaign && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Save Current Campaign as Template</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="template-name">Template Name*</Label>
                      <Input
                        id="template-name"
                        value={saveForm.name}
                        onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                        placeholder="e.g., Spring Sale Email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="template-category">Category</Label>
                      <Input
                        id="template-category"
                        value={saveForm.category}
                        onChange={(e) => setSaveForm({ ...saveForm, category: e.target.value })}
                        placeholder="e.g., Seasonal, Promotional"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={saveForm.description}
                      onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                      placeholder="Describe when and how to use this template..."
                      rows={3}
                    />
                  </div>

                  {/* Preview of current campaign */}
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Campaign Preview</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Subject:</strong> {currentCampaign.subject_line}</div>
                      <div><strong>Blocks:</strong> {currentCampaign.content_blocks.length} content blocks</div>
                      <div><strong>Block Types:</strong> {
                        Array.from(new Set(currentCampaign.content_blocks.map(b => b.type))).join(', ')
                      }</div>
                    </div>
                  </div>

                  <Button onClick={handleSaveTemplate} className="w-full">
                    Save as Template
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Template Card Component
interface TemplateCardProps {
  template: CampaignTemplate;
  onApply: () => void;
  onDelete: () => void;
  onPreview: () => void;
  isTopPerforming?: boolean;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onApply,
  onDelete,
  onPreview,
  isTopPerforming
}) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-medium text-sm mb-1">{template.name}</h4>
            <Badge variant="secondary" className="text-xs">
              {template.category}
            </Badge>
            {isTopPerforming && (
              <Badge variant="default" className="text-xs ml-1">
                <Star className="h-3 w-3 mr-1" />
                Top
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {template.description}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>Used {template.usage_count} times</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{new Date(template.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={onApply} className="flex-1">
            <Copy className="h-3 w-3 mr-1" />
            Use Template
          </Button>
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};