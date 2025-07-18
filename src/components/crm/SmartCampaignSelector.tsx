
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Clock, Users, TrendingUp } from 'lucide-react';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  expectedOpenRate: string;
  estimatedSetupTime: string;
  targetAudience: string;
  preview: {
    subject: string;
    content: string;
  };
}

interface SmartCampaignSelectorProps {
  onTemplateSelect: (template: CampaignTemplate) => void;
  selectedTemplate?: CampaignTemplate | null;
}

const SmartCampaignSelector: React.FC<SmartCampaignSelectorProps> = ({
  onTemplateSelect,
  selectedTemplate
}) => {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Garden center email templates
  const campaignTemplates: CampaignTemplate[] = [
    {
      id: 'spring-prep',
      name: 'Spring Garden Preparation',
      description: 'Help customers get their gardens ready for the growing season with essential tips and products.',
      category: 'seasonal',
      expectedOpenRate: '28%',
      estimatedSetupTime: '15 min',
      targetAudience: 'Seasonal gardeners',
      preview: {
        subject: '🌱 Spring is Coming - Get Your Garden Ready!',
        content: 'Spring preparation tips, soil testing recommendations, and early planting guides...'
      }
    },
    {
      id: 'new-customer-welcome',
      name: 'New Customer Welcome Series',
      description: 'Welcome new gardeners with a nurturing email series that builds loyalty and provides value.',
      category: 'welcome',
      expectedOpenRate: '42%',
      estimatedSetupTime: '20 min',
      targetAudience: 'New customers',
      preview: {
        subject: 'Welcome to [Garden Center] - Your Growing Journey Starts Here!',
        content: 'Welcome message, getting started guide, and first purchase recommendations...'
      }
    },
    {
      id: 'plant-care-tips',
      name: 'Seasonal Plant Care Reminders',
      description: 'Automated care tips based on the season and customer purchase history.',
      category: 'educational',
      expectedOpenRate: '35%',
      estimatedSetupTime: '25 min',
      targetAudience: 'Active gardeners',
      preview: {
        subject: 'Time to Care for Your [Plant Type] 🌿',
        content: 'Personalized care instructions, watering schedules, and troubleshooting tips...'
      }
    },
    {
      id: 'summer-watering',
      name: 'Summer Watering Guide',
      description: 'Help customers keep their plants thriving through hot summer months.',
      category: 'seasonal',
      expectedOpenRate: '31%',
      estimatedSetupTime: '18 min',
      targetAudience: 'Summer gardeners',
      preview: {
        subject: 'Beat the Heat - Essential Summer Watering Tips ☀️',
        content: 'Watering schedules, drought-resistant plants, and heat protection strategies...'
      }
    },
    {
      id: 'fall-planting',
      name: 'Fall Planting Opportunities',
      description: 'Educate customers about the benefits of fall planting and available options.',
      category: 'seasonal',
      expectedOpenRate: '26%',
      estimatedSetupTime: '22 min',
      targetAudience: 'Year-round gardeners',
      preview: {
        subject: 'Fall Planting - The Secret to Spring Success 🍂',
        content: 'Fall planting benefits, recommended plants, and preparation tips...'
      }
    },
    {
      id: 'holiday-arrangements',
      name: 'Holiday Arrangement Promotions',
      description: 'Promote seasonal arrangements and holiday decorating services.',
      category: 'promotional',
      expectedOpenRate: '29%',
      estimatedSetupTime: '20 min',
      targetAudience: 'Holiday decorators',
      preview: {
        subject: 'Create Magical Holiday Arrangements ✨',
        content: 'Holiday arrangement options, custom services, and early bird specials...'
      }
    }
  ];

  useEffect(() => {
    // Simulate loading templates
    setLoading(true);
    setTimeout(() => {
      setTemplates(campaignTemplates);
      setLoading(false);
    }, 500);
  }, []);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'seasonal', label: 'Seasonal' },
    { value: 'welcome', label: 'Welcome Series' },
    { value: 'educational', label: 'Educational' },
    { value: 'promotional', label: 'Promotional' }
  ];

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(template => template.category === selectedCategory);

  const getCategoryBadgeColor = (category: string) => {
    const colors = {
      seasonal: 'bg-orange-100 text-orange-800',
      welcome: 'bg-blue-100 text-blue-800',
      educational: 'bg-green-100 text-green-800',
      promotional: 'bg-purple-100 text-purple-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Campaign Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Campaign Templates
        </CardTitle>
        <div className="flex items-center gap-4 mt-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate?.id === template.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => onTemplateSelect(template)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </div>
                <Badge className={getCategoryBadgeColor(template.category)}>
                  {template.category}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {template.expectedOpenRate} open rate
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedSetupTime} setup
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {template.targetAudience}
                </div>
              </div>

              <div className="bg-muted/30 rounded p-3 space-y-2">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Subject Preview:</span>
                  <p className="text-sm">{template.preview.subject}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Content Preview:</span>
                  <p className="text-sm text-muted-foreground">{template.preview.content}</p>
                </div>
              </div>

              {selectedTemplate?.id === template.id && (
                <div className="mt-3 pt-3 border-t">
                  <Badge variant="default" className="bg-primary text-primary-foreground">
                    Selected Template
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No templates found for this category.</p>
          </div>
        )}

        {selectedTemplate && (
          <div className="mt-6 pt-4 border-t">
            <Button 
              onClick={() => onTemplateSelect(selectedTemplate)}
              className="w-full"
            >
              Use Selected Template
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartCampaignSelector;
