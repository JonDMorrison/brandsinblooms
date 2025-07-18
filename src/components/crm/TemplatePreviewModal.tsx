import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';
import { EmailBlockRenderer } from '@/components/crm/EmailBlockRenderer';
import { Eye, Download, Calendar, User } from 'lucide-react';

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

interface TemplatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  template: SavedTemplate | null;
  onInsertTemplate: (blocks: EmailBlock[], templateName: string) => void;
}

const defaultGlobalSettings: GlobalSettings = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  buttonStyle: {
    cornerRadius: '6px',
    backgroundColor: '#22C55E',
    textColor: '#FFFFFF'
  },
  headerStyle: {
    backgroundColor: '#F8F9FA',
    textColor: '#1F2937'
  },
  footerStyle: {
    backgroundColor: '#F8F9FA', 
    textColor: '#6B7280'
  }
};

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  open,
  onClose,
  template,
  onInsertTemplate
}) => {
  if (!template) return null;

  const handleInsert = () => {
    onInsertTemplate(template.layout_json, template.name);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Eye className="h-5 w-5" />
                {template.name}
              </DialogTitle>
              <p className="text-muted-foreground mt-2">{template.description}</p>
            </div>
            <Button onClick={handleInsert} className="gap-2">
              <Download className="h-4 w-4" />
              Use This Template
            </Button>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="capitalize">
              {template.category}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Used {template.usage_count} times
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(template.created_at).toLocaleDateString()}
            </div>
          </div>
          
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {template.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <div className="p-6 bg-white">
              <div className="space-y-2">
                {template.layout_json.map((block, index) => (
                  <div key={`${block.id}-${index}`}>
                    <EmailBlockRenderer 
                      block={block}
                      globalSettings={defaultGlobalSettings}
                      isPreview={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
          
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Preview shows how this template will look when inserted into your campaign
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};