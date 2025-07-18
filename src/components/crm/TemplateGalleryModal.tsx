import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailBlock } from '@/types/emailBuilder';
import { Search, Eye, Download, Sparkles, Calendar, Gift, GraduationCap, Heart } from 'lucide-react';

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  tags: string[];
  layout_json: EmailBlock[];
  usage_count: number;
  created_at: string;
}

interface TemplateGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onInsertTemplate: (blocks: EmailBlock[], templateName: string) => void;
}

const categoryIcons = {
  seasonal: Calendar,
  promotional: Sparkles,
  educational: GraduationCap,
  welcome: Heart,
  holiday: Gift
};

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  open,
  onClose,
  onInsertTemplate
}) => {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'name'>('popular');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);

  const categories = ['seasonal', 'promotional', 'educational', 'welcome', 'holiday'];

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  useEffect(() => {
    filterAndSortTemplates();
  }, [templates, searchQuery, selectedCategories, sortBy]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_campaign_templates')
        .select('*')
        .eq('is_public', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      const processedTemplates: SavedTemplate[] = (data || []).map(template => ({
        id: template.id,
        name: template.name,
        description: template.description || '',
        thumbnail_url: template.thumbnail_url || '',
        category: template.category || 'general',
        tags: template.tags || [],
        layout_json: (template.layout_json as any) || [],
        usage_count: template.usage_count || 0,
        created_at: template.created_at
      }));
      setTemplates(processedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortTemplates = () => {
    let filtered = templates.filter(template => {
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategories.length === 0 ||
        selectedCategories.includes(template.category.toLowerCase());

      return matchesSearch && matchesCategory;
    });

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.usage_count - a.usage_count;
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredTemplates(filtered);
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleInsertTemplate = async (template: SavedTemplate) => {
    try {
      // Update usage count
      await supabase
        .from('saved_campaign_templates')
        .update({ usage_count: template.usage_count + 1 })
        .eq('id', template.id);

      onInsertTemplate(template.layout_json, template.name);
      toast.success('Template inserted successfully!');
      onClose();
    } catch (error) {
      console.error('Error inserting template:', error);
      toast.error('Failed to insert template');
    }
  };

  const requestInsert = (template: SavedTemplate) => {
    setSelectedTemplate(template);
    setShowConfirmDialog(true);
  };

  const TemplateCard: React.FC<{ template: SavedTemplate }> = ({ template }) => {
    const IconComponent = categoryIcons[template.category.toLowerCase() as keyof typeof categoryIcons] || Sparkles;
    
    return (
      <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Template Preview */}
            <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
              {template.thumbnail_url ? (
                <img 
                  src={template.thumbnail_url} 
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <IconComponent className="h-8 w-8 text-gray-400" />
              )}
              
              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => requestInsert(template)}
                >
                  <Download className="h-4 w-4" />
                  Insert
                </Button>
              </div>
            </div>

            {/* Template Info */}
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-1">{template.name}</h4>
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                {template.description || 'Professional email template'}
              </p>
              
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs capitalize">
                  <IconComponent className="h-3 w-3 mr-1" />
                  {template.category}
                </Badge>
                
                {template.usage_count > 0 && (
                  <span className="text-xs text-gray-500">
                    {template.usage_count} uses
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Choose a Template
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Filters Sidebar */}
            <div className="w-64 border-r bg-muted/20 p-6 space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <div>
                <h4 className="font-medium mb-3">Category</h4>
                <div className="space-y-2">
                  {categories.map(category => {
                    const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
                    return (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={category}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={() => handleCategoryToggle(category)}
                        />
                        <label 
                          htmlFor={category}
                          className="text-sm capitalize flex items-center gap-2 cursor-pointer"
                        >
                          <IconComponent className="h-4 w-4" />
                          {category}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h4 className="font-medium mb-3">Sort by</h4>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="name">A–Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="h-48 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No templates found</h3>
                  <p>Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map(template => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Existing Content?</AlertDialogTitle>
            <AlertDialogDescription>
              Inserting this template will replace all content currently in your email. This action cannot be undone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedTemplate) {
                  handleInsertTemplate(selectedTemplate);
                }
                setShowConfirmDialog(false);
              }}
            >
              Insert Template
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};