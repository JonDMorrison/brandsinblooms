import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Sparkles, 
  Clock, 
  Users, 
  TrendingUp, 
  Search, 
  Plus, 
  Edit3, 
  HelpCircle,
  Image,
  MousePointer,
  Star,
  BarChart3,
  Palette
} from 'lucide-react';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  expectedOpenRate: string;
  estimatedSetupTime: string;
  targetAudience: string;
  usageCount: number;
  thumbnail: string;
  preview: {
    subject: string;
    content: string;
  };
}

interface SmartCampaignSelectorProps {
  onTemplateSelect: (template: CampaignTemplate | null) => void;
  selectedTemplate?: CampaignTemplate | null;
}

const SmartCampaignSelector: React.FC<SmartCampaignSelectorProps> = ({
  onTemplateSelect,
  selectedTemplate
}) => {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('most-used');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  // Enhanced garden center email templates with thumbnails
  const campaignTemplates: CampaignTemplate[] = [
    {
      id: 'spring-prep',
      name: 'Spring Garden Launch',
      description: 'Seasonal promo with 3 image + text blocks showcasing spring essentials',
      category: 'seasonal',
      expectedOpenRate: '31%',
      estimatedSetupTime: '15 min',
      targetAudience: 'Seasonal gardeners',
      usageCount: 127,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: '🌱 Spring is Coming - Get Your Garden Ready!',
        content: 'Spring preparation tips, soil testing recommendations, and early planting guides...'
      }
    },
    {
      id: 'new-customer-welcome',
      name: 'New Customer Welcome',
      description: 'Welcome series with brand story, tips, and first-purchase incentive',
      category: 'welcome',
      expectedOpenRate: '42%',
      estimatedSetupTime: '20 min',
      targetAudience: 'New customers',
      usageCount: 89,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: 'Welcome to [Garden Center] - Your Growing Journey Starts Here!',
        content: 'Welcome message, getting started guide, and first purchase recommendations...'
      }
    },
    {
      id: 'plant-care-tips',
      name: 'Plant Care Reminders',
      description: 'Educational email with care tips, troubleshooting, and product suggestions',
      category: 'educational',
      expectedOpenRate: '35%',
      estimatedSetupTime: '25 min',
      targetAudience: 'Active gardeners',
      usageCount: 156,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: 'Time to Care for Your [Plant Type] 🌿',
        content: 'Personalized care instructions, watering schedules, and troubleshooting tips...'
      }
    },
    {
      id: 'summer-watering',
      name: 'Summer Watering Guide',
      description: 'Beat-the-heat campaign with watering tips and drought-resistant plants',
      category: 'seasonal',
      expectedOpenRate: '28%',
      estimatedSetupTime: '18 min',
      targetAudience: 'Summer gardeners',
      usageCount: 94,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: 'Beat the Heat - Essential Summer Watering Tips ☀️',
        content: 'Watering schedules, drought-resistant plants, and heat protection strategies...'
      }
    },
    {
      id: 'fall-planting',
      name: 'Fall Planting Success',
      description: 'Educational campaign about fall planting benefits with product showcase',
      category: 'seasonal',
      expectedOpenRate: '26%',
      estimatedSetupTime: '22 min',
      targetAudience: 'Year-round gardeners',
      usageCount: 73,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: 'Fall Planting - The Secret to Spring Success 🍂',
        content: 'Fall planting benefits, recommended plants, and preparation tips...'
      }
    },
    {
      id: 'holiday-arrangements',
      name: 'Holiday Arrangements',
      description: 'Festive promotional email with arrangement gallery and custom services',
      category: 'promotional',
      expectedOpenRate: '33%',
      estimatedSetupTime: '20 min',
      targetAudience: 'Holiday decorators',
      usageCount: 112,
      thumbnail: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
      preview: {
        subject: 'Create Magical Holiday Arrangements ✨',
        content: 'Holiday arrangement options, custom services, and early bird specials...'
      }
    }
  ];

  useEffect(() => {
    // Load saved category preference
    const savedCategory = localStorage.getItem('email_template_category');
    if (savedCategory && savedCategory !== 'all') {
      setSelectedCategory(savedCategory);
    }

    // Simulate loading templates
    setLoading(true);
    setTimeout(() => {
      setTemplates(campaignTemplates);
      setLoading(false);
    }, 800);
  }, []);

  useEffect(() => {
    // Save category preference
    if (selectedCategory !== 'all') {
      localStorage.setItem('email_template_category', selectedCategory);
    }
  }, [selectedCategory]);

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'seasonal', label: 'Seasonal' },
    { value: 'welcome', label: 'Welcome' },
    { value: 'educational', label: 'Educational' },
    { value: 'promotional', label: 'Promotional' }
  ];

  const sortOptions = [
    { value: 'most-used', label: 'Most Used' },
    { value: 'newest', label: 'Newest' },
    { value: 'best-performance', label: 'Best Performance' },
    { value: 'quickest-setup', label: 'Quickest Setup' }
  ];

  const filteredAndSortedTemplates = () => {
    let filtered = selectedCategory === 'all' 
      ? templates 
      : templates.filter(template => template.category === selectedCategory);

    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'most-used':
          return b.usageCount - a.usageCount;
        case 'best-performance':
          return parseFloat(b.expectedOpenRate) - parseFloat(a.expectedOpenRate);
        case 'quickest-setup':
          return parseInt(a.estimatedSetupTime) - parseInt(b.estimatedSetupTime);
        case 'newest':
        default:
          return 0; // Keep original order for newest
      }
    });
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      seasonal: '🌸',
      welcome: '👋',
      educational: '📚',
      promotional: '🎯'
    };
    return icons[category as keyof typeof icons] || '📧';
  };

  const handleTemplateSelect = (template: CampaignTemplate | null) => {
    onTemplateSelect(template);
  };

  const handleStartFromScratch = () => {
    onTemplateSelect(null);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-center mb-8">
          <div className="h-8 bg-gray-200 rounded w-80 mx-auto mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 mx-auto animate-pulse"></div>
        </div>
        
        <div className="flex gap-4 mb-8">
          <div className="h-10 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-40 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border rounded-xl p-0 overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-200"></div>
              <div className="p-6 space-y-3">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const processedTemplates = filteredAndSortedTemplates();

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
          📧 How would you like to start this email?
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Choose from our proven templates designed for garden centers, or build from scratch with complete creative control.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
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

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                What's a campaign template?
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Templates are pre-designed email layouts with proven performance. They save time and include industry-specific content for garden centers.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 mb-6">
        <Badge variant="outline" className="text-sm">
          {processedTemplates.length + 1} option{processedTemplates.length !== 0 ? 's' : ''} available
        </Badge>
        {searchQuery && (
          <Badge variant="secondary" className="text-sm">
            Results for "{searchQuery}"
          </Badge>
        )}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Start from Scratch Card */}
        <Card 
          className={`group cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-2 ${
            selectedTemplate === null 
              ? 'ring-2 ring-primary border-primary bg-primary/5' 
              : 'border-gray-200 hover:border-primary/50'
          }`}
          onClick={handleStartFromScratch}
        >
          <div className="relative overflow-hidden">
            {/* Custom "thumbnail" for start from scratch */}
            <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <div className="text-center">
                <Plus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <div className="text-sm text-gray-500 font-medium">Build Your Own</div>
              </div>
            </div>
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button className="gap-2 transform scale-95 group-hover:scale-100 transition-transform">
                <Edit3 className="h-4 w-4" />
                Start Building
              </Button>
            </div>
          </div>
          
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-lg text-gray-900">Start from Scratch</h3>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Custom
                </Badge>
              </div>
              
              <p className="text-gray-600 text-sm leading-relaxed">
                Build your email block-by-block with complete creative control and unlimited customization options.
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Full control
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  30+ min setup
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Cards */}
        {processedTemplates.map((template) => (
          <Card 
            key={template.id}
            className={`group cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 border-2 ${
              selectedTemplate?.id === template.id 
                ? 'ring-2 ring-primary border-primary bg-primary/5' 
                : 'border-gray-200 hover:border-primary/50'
            }`}
            onClick={() => handleTemplateSelect(template)}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
          >
            <div className="relative overflow-hidden">
              {/* Template thumbnail */}
              <div className="h-48 bg-gray-100 relative">
                <img 
                  src={template.thumbnail} 
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Category badge overlay */}
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary" className="bg-white/90 text-gray-700 font-medium">
                    {getCategoryIcon(template.category)} {template.category}
                  </Badge>
                </div>

                {/* Usage count badge */}
                <div className="absolute top-3 right-3">
                  <Badge variant="outline" className="bg-white/90 text-gray-600 border-gray-300">
                    <Star className="h-3 w-3 mr-1" />
                    {template.usageCount} uses
                  </Badge>
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button className="gap-2 transform scale-95 group-hover:scale-100 transition-transform">
                    <MousePointer className="h-4 w-4" />
                    Use Template
                  </Button>
                </div>
              </div>
            </div>
            
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg text-gray-900 leading-tight">{template.name}</h3>
                </div>
                
                <p className="text-gray-600 text-sm leading-relaxed">
                  {template.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Avg {template.expectedOpenRate} open rate
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {template.estimatedSetupTime} setup
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="h-3 w-3" />
                  Best for: {template.targetAudience}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No results */}
      {processedTemplates.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search or filter criteria, or start from scratch to build your own.
          </p>
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </div>
      )}

      {/* Selected template confirmation */}
      {selectedTemplate && (
        <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden">
                <img 
                  src={selectedTemplate.thumbnail} 
                  alt={selectedTemplate.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">Selected: {selectedTemplate.name}</h4>
              <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">
              Template Selected
            </Badge>
          </div>
        </div>
      )}
      
      {selectedTemplate === null && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-4">
            <Plus className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900">Starting from Scratch</h4>
              <p className="text-sm text-blue-700">You'll have complete creative freedom to build your email exactly as you envision it.</p>
            </div>
            <Badge className="bg-blue-600 text-white">
              Custom Build
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartCampaignSelector;