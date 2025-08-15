import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
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
    <Modal
      open={isOpen}
      onOpenChange={onClose}
      title="Newsletter Templates"
      description="Choose a template to get started with your newsletter campaign"
      size="lg"
    >
      <div className="space-y-4">
        {newsletterTemplates.map((template) => (
          <div
            key={template.id}
            className={`glass grad-border p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-glow hover:-translate-y-0.5 ${
              selectedTemplate === template.id ? 'ring-2 ring-brand-green' : ''
            }`}
            onClick={() => setSelectedTemplate(template.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-grad-primary flex items-center justify-center">
                  <div className="text-white">{template.icon}</div>
                </div>
                <h3 className="font-heading text-lg text-ink-1">{template.title}</h3>
              </div>
              <Badge variant="secondary" className="bg-white/10 text-ink-2 border-white/10">
                {template.category}
              </Badge>
            </div>
            
            <p className="text-sm text-ink-2 mb-3">
              {template.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs bg-white/5 text-ink-2 border-white/20">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-ink-2">
                Est. {template.estimatedTime}
              </span>
            </div>
            
            {selectedTemplate === template.id && (
              <Button 
                className="btn-blue w-full mt-3"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectTemplate(template.id);
                }}
              >
                Use This Template
              </Button>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-white/10">
        <Button variant="outline" className="btn-ghost w-full" onClick={onClose}>
          Start from Scratch
        </Button>
      </div>
    </Modal>
  );
};