
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Calendar, Tag, Percent, BookOpen, Eye, Plus } from 'lucide-react';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';

interface EmailTemplate {
  id: string;
  name: string;
  category: 'seasonal' | 'promotional' | 'educational' | 'custom';
  subcategory?: string;
  description: string;
  thumbnail: string;
  blocks: EmailBlock[];
  globalSettings: GlobalSettings;
  tags: string[];
  isPopular?: boolean;
  createdAt: string;
}

interface TemplateLibraryProps {
  onSelectTemplate: (template: EmailTemplate) => void;
  onCreateNew: () => void;
}

const SEASONAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'spring-planting-guide',
    name: 'Spring Planting Guide',
    category: 'seasonal',
    subcategory: 'spring',
    description: 'Perfect for early spring gardening tips and plant recommendations',
    thumbnail: '/api/placeholder/300/200',
    tags: ['spring', 'planting', 'guide'],
    isPopular: true,
    createdAt: '2024-01-15',
    blocks: [
      {
        id: '1',
        block_type: 'header',
        content: {
          title: 'Spring Has Sprung! 🌱',
          subtitle: 'Your Ultimate Spring Planting Guide'
        },
        order_index: 0,
        campaign_id: ''
      },
      {
        id: '2',
        block_type: 'text',
        content: {
          title: 'Welcome to Spring Gardening Season!',
          content: 'As the frost melts away and longer days return, it\'s time to prepare your garden for the growing season ahead. Our spring planting guide will help you make the most of this exciting time.'
        },
        order_index: 1,
        campaign_id: ''
      }
    ],
    globalSettings: {
      fontFamily: 'Inter',
      fontSize: '16px',
      buttonStyle: {
        cornerRadius: '8px',
        backgroundColor: '#22C55E',
        textColor: '#FFFFFF'
      },
      headerStyle: {
        backgroundColor: '#F0FDF4',
        textColor: '#15803D'
      },
      footerStyle: {
        backgroundColor: '#F9FAFB',
        textColor: '#6B7280'
      }
    }
  },
  {
    id: 'summer-care-tips',
    name: 'Summer Care Tips',
    category: 'seasonal',
    subcategory: 'summer',
    description: 'Keep gardens thriving through the hot summer months',
    thumbnail: '/api/placeholder/300/200',
    tags: ['summer', 'care', 'watering'],
    createdAt: '2024-02-10',
    blocks: [
      {
        id: '1',
        block_type: 'header',
        content: {
          title: 'Beat the Summer Heat! ☀️',
          subtitle: 'Essential Summer Garden Care'
        },
        order_index: 0,
        campaign_id: ''
      }
    ],
    globalSettings: {
      fontFamily: 'Inter',
      fontSize: '16px',
      buttonStyle: {
        cornerRadius: '8px',
        backgroundColor: '#F59E0B',
        textColor: '#FFFFFF'
      },
      headerStyle: {
        backgroundColor: '#FEF3C7',
        textColor: '#D97706'
      },
      footerStyle: {
        backgroundColor: '#F9FAFB',
        textColor: '#6B7280'
      }
    }
  }
];

const PROMOTIONAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'weekend-sale',
    name: 'Weekend Sale',
    category: 'promotional',
    subcategory: 'sale',
    description: 'Perfect for weekend promotions and flash sales',
    thumbnail: '/api/placeholder/300/200',
    tags: ['sale', 'weekend', 'discount'],
    isPopular: true,
    createdAt: '2024-01-20',
    blocks: [
      {
        id: '1',
        block_type: 'header',
        content: {
          title: 'Weekend Flash Sale! 🎉',
          subtitle: 'Save up to 30% on select plants'
        },
        order_index: 0,
        campaign_id: ''
      }
    ],
    globalSettings: {
      fontFamily: 'Inter',
      fontSize: '16px',
      buttonStyle: {
        cornerRadius: '8px',
        backgroundColor: '#DC2626',
        textColor: '#FFFFFF'
      },
      headerStyle: {
        backgroundColor: '#FEE2E2',
        textColor: '#DC2626'
      },
      footerStyle: {
        backgroundColor: '#F9FAFB',
        textColor: '#6B7280'
      }
    }
  }
];

const EDUCATIONAL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'plant-care-basics',
    name: 'Plant Care Basics',
    category: 'educational',
    subcategory: 'how-to',
    description: 'Educational content about basic plant care',
    thumbnail: '/api/placeholder/300/200',
    tags: ['education', 'care', 'basics'],
    createdAt: '2024-01-25',
    blocks: [
      {
        id: '1',
        block_type: 'header',
        content: {
          title: 'Master Plant Care 📚',
          subtitle: 'Essential tips for healthy plants'
        },
        order_index: 0,
        campaign_id: ''
      }
    ],
    globalSettings: {
      fontFamily: 'Inter',
      fontSize: '16px',
      buttonStyle: {
        cornerRadius: '8px',
        backgroundColor: '#3B82F6',
        textColor: '#FFFFFF'
      },
      headerStyle: {
        backgroundColor: '#DBEAFE',
        textColor: '#1D4ED8'
      },
      footerStyle: {
        backgroundColor: '#F9FAFB',
        textColor: '#6B7280'
      }
    }
  }
];

export const TemplateLibrary = ({ onSelectTemplate, onCreateNew }: TemplateLibraryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filteredTemplates, setFilteredTemplates] = useState<EmailTemplate[]>([]);

  const allTemplates = [...SEASONAL_TEMPLATES, ...PROMOTIONAL_TEMPLATES, ...EDUCATIONAL_TEMPLATES];

  useEffect(() => {
    let filtered = allTemplates;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => 
        selectedCategory === 'popular' ? template.isPopular : template.category === selectedCategory
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  }, [searchTerm, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'seasonal': return <Calendar className="h-4 w-4" />;
      case 'promotional': return <Percent className="h-4 w-4" />;
      case 'educational': return <BookOpen className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'seasonal': return 'bg-green-100 text-green-800';
      case 'promotional': return 'bg-red-100 text-red-800';
      case 'educational': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Templates</h2>
          <p className="text-gray-600">Choose from our collection of professionally designed templates</p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Template
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
            <TabsTrigger value="promotional">Promotional</TabsTrigger>
            <TabsTrigger value="educational">Educational</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="group hover:shadow-lg transition-shadow cursor-pointer">
            <div className="aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
              <img 
                src={template.thumbnail} 
                alt={template.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  </div>
                  {template.isPopular && (
                    <Badge variant="secondary" className="text-xs">Popular</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getCategoryColor(template.category)}`}
                  >
                    {getCategoryIcon(template.category)}
                    <span className="ml-1 capitalize">{template.category}</span>
                  </Badge>
                  {template.subcategory && (
                    <Badge variant="outline" className="text-xs">
                      {template.subcategory}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {template.tags.slice(0, 3).map((tag) => (
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

                <div className="flex items-center gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {/* Preview functionality */}}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => onSelectTemplate(template)}
                  >
                    Use Template
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search or browse a different category
          </p>
          <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};
