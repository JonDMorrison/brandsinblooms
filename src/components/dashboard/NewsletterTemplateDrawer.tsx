import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Tag, Users } from "lucide-react";

interface NewsletterTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const newsletterTemplates = [
  {
    id: 'holiday-focus',
    title: 'Holiday Focus Newsletter',
    description: 'Seasonal content highlighting holiday plants and decorations',
    category: 'Seasonal',
    estimatedTime: '15 min',
    icon: <Calendar className="w-5 h-5" />,
    tags: ['Holiday', 'Seasonal', 'Plants']
  },
  {
    id: 'promo-blast',
    title: 'Promotional Blast',
    description: 'Quick promotional email for sales and special offers',
    category: 'Marketing',
    estimatedTime: '10 min',
    icon: <Tag className="w-5 h-5" />,
    tags: ['Sale', 'Promotion', 'Discount']
  },
  {
    id: 'customer-tips',
    title: 'Garden Care Tips',
    description: 'Educational newsletter with gardening tips and advice',
    category: 'Educational',
    estimatedTime: '20 min',
    icon: <Users className="w-5 h-5" />,
    tags: ['Tips', 'Education', 'Care']
  },
  {
    id: 'new-arrivals',
    title: 'New Arrivals Showcase',
    description: 'Highlight new plants and products in your inventory',
    category: 'Product',
    estimatedTime: '12 min',
    icon: <Mail className="w-5 h-5" />,
    tags: ['New', 'Products', 'Inventory']
  }
];

export const NewsletterTemplateDrawer = ({ isOpen, onClose }: NewsletterTemplateDrawerProps) => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    // Navigate to newsletter creation with template pre-selected
    navigate(`/crm/campaigns/new?type=newsletter&template=${templateId}`);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:w-[700px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Newsletter Templates
          </SheetTitle>
          <SheetDescription>
            Choose a template to get started with your newsletter campaign
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {newsletterTemplates.map((template) => (
            <Card 
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    {template.icon}
                    {template.title}
                  </div>
                  <Badge variant="secondary">{template.category}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Est. {template.estimatedTime}
                  </span>
                </div>
                {selectedTemplate === template.id && (
                  <Button 
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTemplate(template.id);
                    }}
                  >
                    Use This Template
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Start from Scratch
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};