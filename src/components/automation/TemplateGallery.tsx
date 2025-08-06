import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  Users,
  Mail,
  MessageSquare,
  GitBranch
} from 'lucide-react';

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  flow_data: {
    nodes: any[];
    edges: any[];
  };
  kpi_data: {
    avg_ctr: number;
    avg_revenue_per_send: number;
  };
  is_active: boolean;
}

interface TemplateGalleryProps {
  onSelectTemplate: (template: AutomationTemplate) => void;
  selectedCategory?: string;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  onSelectTemplate,
  selectedCategory,
}) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      // TODO: Replace with actual template fetch once table is populated
      // For now, using mock data to prevent TypeScript errors
      const mockTemplates: AutomationTemplate[] = [
        {
          id: 'welcome-series',
          name: 'Welcome Series',
          description: 'Onboard new customers with a 3-step welcome sequence',
          category: 'welcome',
          flow_data: {
            nodes: [
              { id: 'trigger-1', type: 'trigger', position: { x: 100, y: 100 }, data: { triggerType: 'loyalty_join', label: 'New Customer' } },
              { id: 'email-1', type: 'email', position: { x: 100, y: 200 }, data: { subject: 'Welcome!', content: 'Welcome to our community!' } },
              { id: 'delay-1', type: 'delay', position: { x: 100, y: 300 }, data: { delayValue: 1, delayUnit: 'days' } },
              { id: 'sms-1', type: 'sms', position: { x: 100, y: 400 }, data: { content: 'Thanks for joining! Enjoy 10% off your first order.' } }
            ],
            edges: [
              { id: 'e1', source: 'trigger-1', target: 'email-1' },
              { id: 'e2', source: 'email-1', target: 'delay-1' },
              { id: 'e3', source: 'delay-1', target: 'sms-1' }
            ]
          },
          kpi_data: { avg_ctr: 15.2, avg_revenue_per_send: 2.45 },
          is_active: true
        },
        {
          id: 'abandoned-cart',
          name: 'Abandoned Cart Recovery',
          description: 'Win back customers who left items in their cart',
          category: 'retention',
          flow_data: {
            nodes: [
              { id: 'trigger-2', type: 'trigger', position: { x: 100, y: 100 }, data: { triggerType: 'cart_abandonment', label: 'Cart Abandoned' } },
              { id: 'email-2', type: 'email', position: { x: 100, y: 200 }, data: { subject: 'Complete your order', content: 'You left something in your cart...' } }
            ],
            edges: [
              { id: 'e4', source: 'trigger-2', target: 'email-2' }
            ]
          },
          kpi_data: { avg_ctr: 12.8, avg_revenue_per_send: 8.90 },
          is_active: true
        }
      ];
      
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load automation templates.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = selectedCategory
    ? templates.filter(t => t.category === selectedCategory)
    : templates;

  const getNodeCounts = (flowData: any) => {
    const nodes = flowData?.nodes || [];
    return {
      email: nodes.filter((n: any) => n.type === 'email').length,
      sms: nodes.filter((n: any) => n.type === 'sms').length,
      delay: nodes.filter((n: any) => n.type === 'delay').length,
      split: nodes.filter((n: any) => n.type === 'split').length,
    };
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'welcome':
        return <Users className="w-4 h-4" />;
      case 'loyalty':
        return <Zap className="w-4 h-4" />;
      case 'retention':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <GitBranch className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Automation Templates</h2>
        <p className="text-muted-foreground">
          Choose from proven automation workflows to get started quickly
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => {
          const nodeCounts = getNodeCounts(template.flow_data);
          const totalSteps = Object.values(nodeCounts).reduce((a, b) => a + b, 0);

          return (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1">
                    {getCategoryIcon(template.category)}
                    {template.category}
                  </Badge>
                  {template.kpi_data.avg_ctr > 0 && (
                    <Badge variant="secondary">
                      {template.kpi_data.avg_ctr}% CTR
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{totalSteps} steps</span>
                  {nodeCounts.email > 0 && (
                    <>
                      <Mail className="w-3 h-3 ml-2" />
                      <span>{nodeCounts.email}</span>
                    </>
                  )}
                  {nodeCounts.sms > 0 && (
                    <>
                      <MessageSquare className="w-3 h-3 ml-2" />
                      <span>{nodeCounts.sms}</span>
                    </>
                  )}
                </div>

                {template.kpi_data.avg_revenue_per_send > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Avg Revenue: </span>
                    <span className="font-medium text-green-600">
                      ${template.kpi_data.avg_revenue_per_send.toFixed(2)}/send
                    </span>
                  </div>
                )}

                <Button
                  onClick={() => onSelectTemplate(template)}
                  className="w-full"
                  size="sm"
                >
                  Use This Template
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-8">
          <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Templates Found</h3>
          <p className="text-muted-foreground">
            {selectedCategory 
              ? `No templates available in the ${selectedCategory} category.`
              : 'No automation templates are currently available.'
            }
          </p>
        </div>
      )}
    </div>
  );
};