import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Users, 
  RefreshCw,
  Save,
  Sparkles,
  Info,
  Lock,
  Globe,
  UsersRound,
  Zap,
  Eye
} from 'lucide-react';

import { 
  METRICS_CATALOG, 
  getCategories, 
  getMetricDefinition,
} from '@/lib/segmentation/metricsCatalog';
import { useEvaluateSegments } from '@/hooks/useSegmentEvaluation';
import type { SegmentType, SegmentVisibility, ConditionOperator } from '@/types/segmentation';

// Import new builder components
import {
  AutomationRuleBlock,
  InlineLogicConnector,
  SegmentPreviewPanel,
  type ComboboxGroup,
} from './builder';

interface SegmentRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

interface SegmentBuilderProps {
  onSave?: (segment: any) => void;
  initialData?: any;
}

// Category labels for display
const CATEGORY_LABELS: Record<string, string> = {
  identity: '👤 Identity & Profile',
  email_engagement: '📧 Email Engagement',
  sms_engagement: '💬 SMS Engagement',
  cross_channel: '🔗 Cross-Channel',
  purchase: '💰 Purchase Behavior',
  loyalty: '⭐ Loyalty & Perks',
  lifecycle: '📈 Lifecycle',
  risk: '⚠️ Risk Signals',
};

// Group metrics by category for the combobox
const getGroupedMetrics = (): ComboboxGroup[] => {
  return getCategories().map(cat => ({
    id: cat.id,
    label: CATEGORY_LABELS[cat.id] || cat.label,
    options: METRICS_CATALOG
      .filter(m => m.category === cat.id)
      .map(m => ({
        value: m.field,
        label: m.label,
        description: m.description,
        unit: m.unit,
        category: m.category,
      }))
  })).filter(cat => cat.options.length > 0);
};

export const SmartSegmentBuilderBeta = ({ onSave, initialData }: SegmentBuilderProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [segmentType, setSegmentType] = useState<SegmentType>(initialData?.segment_type || 'dynamic');
  const [visibility, setVisibility] = useState<SegmentVisibility>(initialData?.visibility || 'private');
  const [rules, setRules] = useState<SegmentRule[]>(
    initialData?.rules || [
      {
        id: crypto.randomUUID(),
        field: 'total_spent',
        operator: 'greater_than' as ConditionOperator,
        value: 100,
      }
    ]
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [totalCustomers, setTotalCustomers] = useState<number>(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const evaluateSegments = useEvaluateSegments();
  
  const groupedMetrics = useMemo(() => getGroupedMetrics(), []);

  const saveSegmentMutation = useMutation({
    mutationFn: async ({ 
      name, 
      description, 
      rules,
      segmentType,
      visibility
    }: { 
      name: string; 
      description: string; 
      rules: SegmentRule[];
      segmentType: SegmentType;
      visibility: SegmentVisibility;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord) throw new Error('User record not found');

      const queryJson = {
        logic: 'AND',
        conditions: rules.map(r => ({
          field: r.field,
          operator: r.operator,
          value: r.value
        }))
      };

      const { data, error } = await supabase
        .from('crm_segments')
        .insert({
          name,
          description,
          conditions: queryJson as any,
          tenant_id: userRecord.tenant_id,
          user_id: userData.user.id,
          customer_count: previewCount || 0,
          segment_type: segmentType,
          visibility,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      toast({
        title: "Segment Created",
        description: `"${data.name}" has been saved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['crm_segments'] });
      
      if (segmentType === 'dynamic') {
        toast({
          title: "Evaluating Segment",
          description: "Running initial segment evaluation...",
        });
        
        try {
          await evaluateSegments.mutateAsync({ 
            tenantId: data.tenant_id, 
            segmentId: data.id 
          });
          toast({
            title: "Evaluation Complete",
            description: "Segment membership has been calculated",
          });
        } catch (err) {
          console.error('Evaluation error:', err);
        }
      }
      
      onSave?.(data);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Segment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addRule = () => {
    const firstMetric = METRICS_CATALOG[0];
    const newRule: SegmentRule = {
      id: crypto.randomUUID(),
      field: firstMetric.field,
      operator: firstMetric.defaultOperator,
      value: '',
      logicalOperator: 'AND',
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId));
  };

  const updateRule = (ruleId: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map(rule => {
      if (rule.id !== ruleId) return rule;
      
      if (updates.field && updates.field !== rule.field) {
        const metric = getMetricDefinition(updates.field);
        if (metric) {
          return { 
            ...rule, 
            ...updates, 
            operator: metric.defaultOperator,
            value: '' 
          };
        }
      }
      
      return { ...rule, ...updates };
    }));
  };

  const buildFilterCondition = (rule: SegmentRule) => {
    const { field, operator, value } = rule;
    
    switch (operator) {
      case 'equals':
      case 'eq':
      case '=':
        return { method: 'eq', field, value };
      case 'not_equals':
      case 'neq':
      case '!=':
        return { method: 'neq', field, value };
      case 'greater_than':
      case 'gt':
      case '>':
        return { method: 'gt', field, value };
      case 'greater_than_or_equal':
      case 'gte':
      case '>=':
        return { method: 'gte', field, value };
      case 'less_than':
      case 'lt':
      case '<':
        return { method: 'lt', field, value };
      case 'less_than_or_equal':
      case 'lte':
      case '<=':
        return { method: 'lte', field, value };
      case 'contains':
        return { method: 'ilike', field, value: `%${value}%` };
      case 'not_contains':
        return { method: 'not.ilike', field, value: `%${value}%` };
      case 'starts_with':
        return { method: 'ilike', field, value: `${value}%` };
      case 'ends_with':
        return { method: 'ilike', field, value: `%${value}` };
      case 'is_empty':
        return { method: 'is', field, value: null };
      case 'is_not_empty':
        return { method: 'not.is', field, value: null };
      case 'is_true':
        return { method: 'eq', field, value: true };
      case 'is_false':
        return { method: 'eq', field, value: false };
      case 'days_ago_less_than':
        const withinDate = new Date();
        withinDate.setDate(withinDate.getDate() - Number(value));
        return { method: 'gte', field, value: withinDate.toISOString() };
      case 'days_ago_greater_than':
        const olderDate = new Date();
        olderDate.setDate(olderDate.getDate() - Number(value));
        return { method: 'lt', field, value: olderDate.toISOString() };
      default:
        return { method: 'eq', field, value };
    }
  };

  const previewSegment = useCallback(async () => {
    if (rules.length === 0) {
      setPreviewCount(0);
      return;
    }

    setIsLoadingPreview(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('Tenant not found');

      // Get total count first
      const { count: total } = await supabase
        .from('customer_360_enriched')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userRecord.tenant_id);
      
      setTotalCustomers(total || 0);

      // Build query with filters
      let query: any = supabase
        .from('customer_360_enriched')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userRecord.tenant_id);
      
      for (const rule of rules) {
        const filter = buildFilterCondition(rule);
        
        if (filter.method === 'eq') {
          query = query.eq(filter.field, filter.value);
        } else if (filter.method === 'neq') {
          query = query.neq(filter.field, filter.value);
        } else if (filter.method === 'gt') {
          query = query.gt(filter.field, filter.value);
        } else if (filter.method === 'gte') {
          query = query.gte(filter.field, filter.value);
        } else if (filter.method === 'lt') {
          query = query.lt(filter.field, filter.value);
        } else if (filter.method === 'lte') {
          query = query.lte(filter.field, filter.value);
        } else if (filter.method === 'ilike') {
          query = query.ilike(filter.field, String(filter.value));
        } else if (filter.method === 'not.ilike') {
          query = query.not(filter.field, 'ilike', String(filter.value));
        } else if (filter.method === 'is') {
          query = query.is(filter.field, null);
        } else if (filter.method === 'not.is') {
          query = query.not(filter.field, 'is', null);
        }
      }

      const { count, error } = await query;

      if (error) throw error;
      setPreviewCount(count || 0);
      
      toast({
        title: "Preview Ready",
        description: `${count || 0} customers match your criteria.`,
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: "Preview Error",
        description: "Could not preview segment. Check your rules.",
        variant: "destructive",
      });
      setPreviewCount(0);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [rules, toast]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this segment",
        variant: "destructive",
      });
      return;
    }

    if (rules.length === 0) {
      toast({
        title: "Rules Required",
        description: "Please add at least one rule to this segment",
        variant: "destructive",
      });
      return;
    }

    saveSegmentMutation.mutate({ name, description, rules, segmentType, visibility });
  };

  // Generate warnings based on segment size
  const getWarnings = () => {
    const warnings: string[] = [];
    if (previewCount !== null && previewCount < 10) {
      warnings.push('Very small segment (<10 customers). Consider broadening your criteria.');
    }
    if (previewCount !== null && totalCustomers > 0 && previewCount / totalCustomers > 0.9) {
      warnings.push('This segment includes most of your customers. Consider narrowing your criteria.');
    }
    return warnings;
  };

  const visibilityOptions = [
    { value: 'private', label: 'Private', icon: Lock, description: 'Only you' },
    { value: 'team', label: 'Team', icon: UsersRound, description: 'Your team' },
    { value: 'public', label: 'Public', icon: Globe, description: 'Everyone' },
  ];

  return (
    <TooltipProvider>
      <div className="w-full min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Smart Segment Builder</h1>
                  <p className="text-sm text-muted-foreground">Design powerful customer segments visually</p>
                </div>
                <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
                  <Zap className="h-3 w-3 mr-1" />
                  Beta
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveSegmentMutation.isPending || !name.trim() || rules.length === 0}
                  className="gap-2"
                >
                  {saveSegmentMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Segment
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Two Panel Layout */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1fr,380px] gap-6">
            {/* Left Panel - Builder */}
            <div className="space-y-6">
              {/* Segment Info Card */}
              <Card className="border-2">
                <CardContent className="p-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="segment-name" className="text-sm font-medium">
                        Segment Name *
                      </Label>
                      <Input
                        id="segment-name"
                        placeholder="e.g., High Value Customers"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 border-2 hover:border-primary/40 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="segment-description" className="text-sm font-medium">
                        Description
                      </Label>
                      <Input
                        id="segment-description"
                        placeholder="Brief description of this segment"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="h-11 border-2 hover:border-primary/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Settings Row */}
                  <div className="flex flex-wrap items-center gap-6 pt-2">
                    {/* Segment Type Toggle */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Type</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p><strong>Dynamic:</strong> Auto-updates as customer data changes</p>
                            <p className="mt-1"><strong>Frozen:</strong> Locks membership at creation</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/50">
                        <button
                          type="button"
                          onClick={() => setSegmentType('dynamic')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            segmentType === 'dynamic'
                              ? 'bg-primary text-primary-foreground shadow'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <RefreshCw className="h-3 w-3 inline mr-1" />
                          Dynamic
                        </button>
                        <button
                          type="button"
                          onClick={() => setSegmentType('frozen')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            segmentType === 'frozen'
                              ? 'bg-primary text-primary-foreground shadow'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Lock className="h-3 w-3 inline mr-1" />
                          Frozen
                        </button>
                      </div>
                    </div>

                    {/* Visibility */}
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium">Visibility</Label>
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
                        {visibilityOptions.map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <Tooltip key={opt.value}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setVisibility(opt.value as SegmentVisibility)}
                                  className={`p-2 rounded-md transition-all ${
                                    visibility === opt.value
                                      ? 'bg-primary text-primary-foreground shadow'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{opt.label}</p>
                                <p className="text-xs text-muted-foreground">{opt.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rules Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Segment Rules
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Define conditions to filter your customers
                    </p>
                  </div>
                </div>

                {/* Rules List */}
                <div className="space-y-2">
                  {rules.map((rule, index) => {
                    const metric = getMetricDefinition(rule.field);
                    
                    return (
                      <div key={rule.id}>
                        {index > 0 && (
                          <InlineLogicConnector
                            value={rule.logicalOperator || 'AND'}
                            onChange={(value) => updateRule(rule.id, { logicalOperator: value })}
                          />
                        )}
                        <AutomationRuleBlock
                          rule={rule}
                          index={index}
                          metric={metric}
                          groupedMetrics={groupedMetrics}
                          onUpdate={(updates) => updateRule(rule.id, updates)}
                          onRemove={() => removeRule(rule.id)}
                          canRemove={rules.length > 1}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Add Rule Button */}
                <Button
                  variant="outline"
                  onClick={addRule}
                  className="w-full border-dashed border-2 h-12 hover:border-primary hover:bg-primary/5"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Another Rule
                </Button>
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
              <SegmentPreviewPanel
                matchCount={previewCount}
                totalCount={totalCustomers}
                isLoading={isLoadingPreview}
                warnings={getWarnings()}
              />
              
              <Button
                onClick={previewSegment}
                disabled={isLoadingPreview || rules.length === 0}
                className="w-full h-12 gap-2"
                variant="secondary"
              >
                {isLoadingPreview ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview Segment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
