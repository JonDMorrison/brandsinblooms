import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Users, 
  Zap, 
  Calendar, 
  TrendingUp, 
  ShoppingCart,
  Search,
  Clock,
  Mail,
  MessageSquare,
  Star,
  Leaf,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { gardenCenterTemplates, GardenCenterTemplate } from '@/lib/automation/gardenCenterTemplates';

interface TemplateGalleryEnhancedProps {
  onSelectTemplate: (template: any) => void;
  onStartFromScratch: () => void;
}

const categoryIcons = {
  welcome: Users,
  seasonal: Calendar, 
  care: Leaf,
  sales: ShoppingCart,
  retention: TrendingUp
};

const complexityColors = {
  simple: 'bg-green-100 text-green-800 border-green-200',
  advanced: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
  expert: 'bg-red-100 text-red-800 border-red-200'
};

export const TemplateGalleryEnhanced: React.FC<TemplateGalleryEnhancedProps> = ({
  onSelectTemplate,
  onStartFromScratch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<GardenCenterTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    let filtered = gardenCenterTemplates;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.businessGoal.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [searchQuery, selectedCategory]);

  const categories = [
    { id: 'all', label: 'All Templates', count: gardenCenterTemplates.length },
    { id: 'welcome', label: 'Welcome New Customers', count: gardenCenterTemplates.filter(t => t.category === 'welcome').length },
    { id: 'seasonal', label: 'Seasonal Campaigns', count: gardenCenterTemplates.filter(t => t.category === 'seasonal').length },
    { id: 'care', label: 'Plant Care Education', count: gardenCenterTemplates.filter(t => t.category === 'care').length },
    { id: 'sales', label: 'Sales & Promotions', count: gardenCenterTemplates.filter(t => t.category === 'sales').length },
    { id: 'retention', label: 'Customer Retention', count: gardenCenterTemplates.filter(t => t.category === 'retention').length }
  ];

  const handleTemplateSelect = (template: GardenCenterTemplate) => {
    onSelectTemplate({
      id: template.id,
      name: template.name,
      description: template.description,
      flow_data: template.flow_data
    });
  };

  const TemplatePreviewModal = ({ template, onClose }: { template: GardenCenterTemplate; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{template.name}</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </div>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">{template.description}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Template Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Steps:</span>
                    <span>{template.preview.stepCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Emails:</span>
                    <span>{template.preview.emailCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SMS:</span>
                    <span>{template.preview.smsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Setup Time:</span>
                    <span>{template.estimatedSetupTime} min</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Performance</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Open Rate:</span>
                    <span className="text-green-600 font-medium">{template.performance.avgOpenRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Click Rate:</span>
                    <span className="text-blue-600 font-medium">{template.performance.avgClickRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Revenue:</span>
                    <span className="text-green-600 font-medium">${template.performance.avgRevenue}</span>
                  </div>
                </div>
              </div>
            </div>

            {template.seasonalRelevance && (
              <div>
                <h4 className="font-medium mb-2">Best For</h4>
                <div className="flex gap-2">
                  {template.seasonalRelevance.map(season => (
                    <Badge key={season} variant="outline" className="capitalize">
                      {season}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">What You'll Get</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Pre-written messages optimized for garden centers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Proven timing and sequence structure</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Performance benchmarks from similar businesses</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Easy customization for your specific needs</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button onClick={() => handleTemplateSelect(template)} className="flex-1">
                Use This Template
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Use a Template</h3>
                <p className="text-muted-foreground">Start with proven garden center automations</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={onStartFromScratch}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Start From Scratch</h3>
                <p className="text-muted-foreground">Build a custom automation with guided steps</p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name, goal, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid grid-cols-6 w-full">
          {categories.map(category => {
            const Icon = category.id === 'all' ? Star : categoryIcons[category.id as keyof typeof categoryIcons];
            return (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-1 text-xs">
                {Icon && <Icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{category.label}</span>
                <span className="sm:hidden">{category.id === 'all' ? 'All' : category.label.split(' ')[0]}</span>
                <Badge variant="secondary" className="ml-1 text-xs">{category.count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const CategoryIcon = categoryIcons[template.category];
          
          return (
            <Card key={template.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="gap-1">
                    <CategoryIcon className="w-3 h-3" />
                    {template.category}
                  </Badge>
                  <Badge className={`text-xs border ${complexityColors[template.complexity]}`}>
                    {template.complexity}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">{template.name}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{template.estimatedSetupTime} min setup</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{template.preview.stepCount} steps</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    {template.preview.emailCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-500" />
                        <span>{template.preview.emailCount}</span>
                      </div>
                    )}
                    {template.preview.smsCount > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-green-500" />
                        <span>{template.preview.smsCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Performance</div>
                  <div className="flex justify-between text-sm">
                    <span>Open Rate: <span className="font-medium text-green-600">{template.performance.avgOpenRate}%</span></span>
                    <span>Revenue: <span className="font-medium text-green-600">${template.performance.avgRevenue}</span></span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleTemplateSelect(template)}
                    className="flex-1"
                    size="sm"
                  >
                    Use Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <Leaf className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Templates Found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search or browse a different category
          </p>
          <Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal 
          template={selectedTemplate} 
          onClose={() => setSelectedTemplate(null)} 
        />
      )}
    </div>
  );
};