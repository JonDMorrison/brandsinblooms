import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Trash2, 
  Users, 
  Filter,
  RefreshCw,
  Save,
  Sparkles,
  Mail,
  MessageSquare,
  ShoppingCart,
  User,
  AlertTriangle,
  Share2,
  TrendingUp,
  Award,
  Info,
  Lock,
  UsersRound,
  Globe
} from 'lucide-react';

import { 
  METRICS_CATALOG, 
  getCategories, 
  getMetricDefinition,
  getOperatorLabel 
} from '@/lib/segmentation/metricsCatalog';
import { useEvaluateSegments } from '@/hooks/useSegmentEvaluation';
import type { SegmentType, SegmentVisibility, ConditionOperator } from '@/types/segmentation';

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

// Category icons mapping
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  identity: User,
  email_engagement: Mail,
  sms_engagement: MessageSquare,
  cross_channel: Share2,
  purchase: ShoppingCart,
  loyalty: Award,
  lifecycle: TrendingUp,
  risk: AlertTriangle,
};

// Category labels for display
const CATEGORY_LABELS: Record<string, string> = {
  identity: '👤 Identity & Profile',
  email_engagement: '📧 Email Engagement',
  sms_engagement: '💬 SMS Engagement',
  cross_channel: '🔗 Cross-Channel',
  purchase: '🛒 Purchase Behavior',
  loyalty: '⭐ Loyalty & Perks',
  lifecycle: '📈 Lifecycle',
  risk: '⚠️ Risk Signals',
};

// Group metrics by category for dropdown
const GROUPED_METRICS = getCategories().map(cat => ({
  ...cat,
  fields: METRICS_CATALOG.filter(m => m.category === cat.id)
})).filter(cat => cat.fields.length > 0);

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
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const evaluateSegments = useEvaluateSegments();

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
      
      // Trigger evaluation for dynamic segments
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
      
      // If field changed, update operator to default for that field
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

  // Build a filter condition for a single rule
  const buildFilterCondition = (rule: SegmentRule) => {
    const { field, operator, value } = rule;
    
    // Map our operators to Supabase filter methods
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
        // Value is number of days, we want records within that many days
        const withinDate = new Date();
        withinDate.setDate(withinDate.getDate() - Number(value));
        return { method: 'gte', field, value: withinDate.toISOString() };
      case 'days_ago_greater_than':
        // Value is number of days, we want records older than that
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
      // Get current user's tenant_id
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('Tenant not found');

      // Build filter conditions for each rule
      const filterConditions: string[] = [];
      
      for (const rule of rules) {
        const filter = buildFilterCondition(rule);
        const { field, value } = filter;
        
        switch (filter.method) {
          case 'eq':
            filterConditions.push(`${field}.eq.${value}`);
            break;
          case 'neq':
            filterConditions.push(`${field}.neq.${value}`);
            break;
          case 'gt':
            filterConditions.push(`${field}.gt.${value}`);
            break;
          case 'gte':
            filterConditions.push(`${field}.gte.${value}`);
            break;
          case 'lt':
            filterConditions.push(`${field}.lt.${value}`);
            break;
          case 'lte':
            filterConditions.push(`${field}.lte.${value}`);
            break;
          case 'ilike':
            filterConditions.push(`${field}.ilike.${value}`);
            break;
          case 'not.ilike':
            filterConditions.push(`${field}.not.ilike.${value}`);
            break;
          case 'is':
            filterConditions.push(`${field}.is.null`);
            break;
          case 'not.is':
            filterConditions.push(`${field}.not.is.null`);
            break;
        }
      }

      // Build query with AND logic - use 'any' to avoid excessive type depth
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('customer_360_enriched')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userRecord.tenant_id);
      
      // Apply filters one by one (AND logic)
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

  const getFieldMetric = (fieldValue: string) => {
    return getMetricDefinition(fieldValue);
  };

  const renderValueInput = (rule: SegmentRule, metric: ReturnType<typeof getMetricDefinition>) => {
    if (!metric) return null;

    // Boolean operators don't need value input
    if (metric.type === 'boolean') {
      return (
        <div className="flex items-center h-10 px-3 text-sm text-muted-foreground bg-muted rounded-md">
          {rule.operator === 'is_true' ? 'Yes' : 'No'}
        </div>
      );
    }

    // Empty/not empty operators don't need value
    if (rule.operator === 'is_empty' || rule.operator === 'is_not_empty') {
      return (
        <div className="flex items-center h-10 px-3 text-sm text-muted-foreground bg-muted rounded-md">
          N/A
        </div>
      );
    }

    // Select options if available
    if (metric.valueOptions && metric.valueOptions.length > 0) {
      return (
        <select
          value={String(rule.value)}
          onChange={(e) => updateRule(rule.id, { value: e.target.value })}
          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background"
        >
          <option value="">Select value</option>
          {metric.valueOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    // Number input
    if (metric.type === 'number') {
      return (
        <div className="flex items-center gap-2">
          {metric.unit === '$' && <span className="text-muted-foreground">$</span>}
          <Input
            type="number"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: Number(e.target.value) })}
            placeholder={metric.placeholder || "Enter value"}
            className="text-sm"
          />
          {metric.unit && metric.unit !== '$' && (
            <span className="text-muted-foreground text-sm">{metric.unit}</span>
          )}
        </div>
      );
    }

    // Date type with days operators
    if (metric.type === 'date') {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: Number(e.target.value) })}
            placeholder="Days"
            className="text-sm"
          />
          <span className="text-muted-foreground text-sm">days</span>
        </div>
      );
    }

    // Default text input
    return (
      <Input
        type="text"
        value={rule.value}
        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
        placeholder={metric.placeholder || "Enter value"}
        className="text-sm"
      />
    );
  };

  return (
    <TooltipProvider>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Smart Segment Builder
            <Badge variant="secondary" className="ml-2">Phase 1</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Segment Name *</Label>
              <Input
                id="segment-name"
                placeholder="e.g., High Value Customers"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment-description">Description</Label>
              <Input
                id="segment-description"
                placeholder="Brief description of this segment"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Segment Type & Visibility */}
          <div className="grid gap-6 md:grid-cols-2 p-4 border rounded-lg bg-muted/30">
            {/* Dynamic/Frozen Toggle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="font-medium">Segment Type</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p><strong>Dynamic:</strong> Automatically updates as customer data changes</p>
                    <p className="mt-1"><strong>Frozen:</strong> Locks membership at creation time</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={segmentType === 'dynamic'}
                  onCheckedChange={(checked) => setSegmentType(checked ? 'dynamic' : 'frozen')}
                />
                <span className="text-sm">
                  {segmentType === 'dynamic' ? (
                    <span className="flex items-center gap-1 text-primary">
                      <RefreshCw className="h-3 w-3" /> Dynamic (auto-updates)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Lock className="h-3 w-3" /> Frozen (static membership)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Visibility Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="font-medium">Visibility</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p><strong>Private:</strong> Only you can see this segment</p>
                    <p className="mt-1"><strong>Team:</strong> Your team members can use it</p>
                    <p className="mt-1"><strong>Public:</strong> All organization users can use it</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as SegmentVisibility)}
                className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="private">🔒 Private</option>
                <option value="team">👥 Team</option>
                <option value="public">🌐 Public</option>
              </select>
            </div>
          </div>

          <Separator />

          {/* Rules */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Segment Rules</h3>
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-3">
              {rules.map((rule, index) => {
                const metric = getFieldMetric(rule.field);
                const CategoryIcon = metric ? CATEGORY_ICONS[metric.category] || Sparkles : Sparkles;

                return (
                  <div 
                    key={rule.id} 
                    className={`p-4 border rounded-lg space-y-3 ${
                      metric?.category === 'risk' ? 'border-destructive/30 bg-destructive/5' : 
                      metric?.category === 'email_engagement' ? 'border-primary/30 bg-primary/5' : ''
                    }`}
                  >
                    {index > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={rule.logicalOperator || 'AND'}
                          onChange={(e) => updateRule(rule.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                          className="px-2 py-1 text-sm border rounded bg-background"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                        <span className="text-sm text-muted-foreground">this rule</span>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-4">
                      {/* Field - Grouped Select */}
                      <div className="space-y-1">
                        <Label className="text-xs">Field</Label>
                        <select
                          value={rule.field}
                          onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          {GROUPED_METRICS.map(category => (
                            <optgroup key={category.id} label={CATEGORY_LABELS[category.id] || category.label}>
                              {category.fields.map(field => (
                                <option key={field.field} value={field.field}>
                                  {field.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      {/* Operator */}
                      <div className="space-y-1">
                        <Label className="text-xs">Operator</Label>
                        <select
                          value={rule.operator}
                          onChange={(e) => updateRule(rule.id, { operator: e.target.value as ConditionOperator })}
                          className="w-full h-10 px-3 py-2 text-sm border rounded-md bg-background"
                        >
                          {metric?.operators.map(op => (
                            <option key={op} value={op}>
                              {getOperatorLabel(op)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value */}
                      <div className="space-y-1">
                        <Label className="text-xs">Value</Label>
                        {renderValueInput(rule, metric)}
                      </div>

                      {/* Remove */}
                      <div className="space-y-1">
                        <Label className="text-xs opacity-0">Remove</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRule(rule.id)}
                          disabled={rules.length === 1}
                          className="w-full h-10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Category indicator */}
                    {metric && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CategoryIcon className="h-3 w-3" />
                        <span>{metric.description}</span>
                        {metric.unit && <Badge variant="outline" className="text-xs">{metric.unit}</Badge>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={previewSegment}
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Preview Segment
            </Button>

            {previewCount !== null && (
              <Badge variant="secondary" className="text-base px-3 py-1">
                {previewCount.toLocaleString()} customers match
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveSegmentMutation.isPending || !name.trim() || rules.length === 0}
            >
              {saveSegmentMutation.isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Segment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
