import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Users, 
  Filter,
  RefreshCw,
  Save,
  X
} from 'lucide-react';

interface SegmentRule {
  id: string;
  field: string;
  operator: string;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

interface SegmentBuilderProps {
  onSave?: (segment: any) => void;
  initialData?: any;
}

const FIELD_OPTIONS = [
  { value: 'enriched_total_spent', label: 'Total Spent', type: 'number' },
  { value: 'order_count', label: 'Order Count', type: 'number' },
  { value: 'last_order_date', label: 'Last Order Date', type: 'date' },
  { value: 'first_order_date', label: 'First Order Date', type: 'date' },
  { value: 'avg_order_value', label: 'Average Order Value', type: 'number' },
  { value: 'loyalty_status', label: 'Loyalty Status', type: 'select', options: ['New', 'Regular', 'Loyal', 'VIP'] },
  { value: 'customer_status', label: 'Customer Status', type: 'select', options: ['Prospect', 'Active', 'At Risk', 'Churned'] },
  { value: 'pos_source', label: 'POS Source', type: 'select', options: ['shopify', 'square', 'vmx'] },
  { value: 'tags', label: 'Tags', type: 'text' },
  { value: 'product_categories', label: 'Product Categories', type: 'text' },
  { value: 'email', label: 'Email Domain', type: 'text' },
];

const OPERATOR_OPTIONS = {
  number: [
    { value: '>', label: 'Greater than' },
    { value: '<', label: 'Less than' },
    { value: '>=', label: 'Greater than or equal' },
    { value: '<=', label: 'Less than or equal' },
    { value: '=', label: 'Equal to' },
    { value: '!=', label: 'Not equal to' },
    { value: 'between', label: 'Between' },
  ],
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'within_days', label: 'Within days' },
    { value: 'older_than_days', label: 'Older than days' },
  ],
  select: [
    { value: '=', label: 'Is' },
    { value: '!=', label: 'Is not' },
    { value: 'in', label: 'In list' },
    { value: 'not_in', label: 'Not in list' },
  ],
};

export const SmartSegmentBuilder = ({ onSave, initialData }: SegmentBuilderProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [rules, setRules] = useState<SegmentRule[]>(
    initialData?.rules || [
      {
        id: crypto.randomUUID(),
        field: 'enriched_total_spent',
        operator: '>',
        value: 100,
      }
    ]
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveSegmentMutation = useMutation({
    mutationFn: async ({ name, description, rules }: { name: string; description: string; rules: SegmentRule[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      // Get user's tenant
      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userRecord) throw new Error('User record not found');

      const queryJson = {
        rules,
        logic: 'AND' // Default to AND logic between rules
      };

      const { data, error } = await supabase
        .from('segments')
        .insert({
          name,
          description,
          query_json: queryJson as any,
          tenant_id: userRecord.tenant_id,
          user_id: userData.user.id,
          count_cached: previewCount || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Segment Created",
        description: `"${data.name}" has been saved successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['segments'] });
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
    const newRule: SegmentRule = {
      id: crypto.randomUUID(),
      field: 'enriched_total_spent',
      operator: '>',
      value: 100,
      logicalOperator: 'AND',
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId));
  };

  const updateRule = (ruleId: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const previewSegment = useCallback(async () => {
    if (rules.length === 0) {
      setPreviewCount(0);
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Build SQL query from rules
      const conditions = rules.map(rule => {
        const field = rule.field;
        const operator = rule.operator;
        const value = rule.value;

        switch (operator) {
          case '>':
          case '<':
          case '>=':
          case '<=':
          case '=':
          case '!=':
            return `${field} ${operator} ${typeof value === 'string' ? `'${value}'` : value}`;
          case 'contains':
            return `${field} ILIKE '%${value}%'`;
          case 'not_contains':
            return `${field} NOT ILIKE '%${value}%'`;
          case 'starts_with':
            return `${field} ILIKE '${value}%'`;
          case 'ends_with':
            return `${field} ILIKE '%${value}'`;
          case 'before':
            return `${field} < '${value}'`;
          case 'after':
            return `${field} > '${value}'`;
          case 'within_days':
            return `${field} > NOW() - INTERVAL '${value} days'`;
          case 'older_than_days':
            return `${field} < NOW() - INTERVAL '${value} days'`;
          case 'between':
            const [min, max] = String(value).split(',');
            return `${field} BETWEEN ${min} AND ${max}`;
          default:
            return `${field} = '${value}'`;
        }
      });

      const whereClause = conditions.join(' AND ');
      
      const { count, error } = await supabase
        .from('customer_360_enriched')
        .select('*', { count: 'exact', head: true })
        .or(whereClause);

      if (error) throw error;
      setPreviewCount(count || 0);
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewCount(0);
      toast({
        title: "Preview Error",
        description: "Unable to preview segment. Please check your rules.",
        variant: "destructive",
      });
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

    saveSegmentMutation.mutate({ name, description, rules });
  };

  const getFieldType = (fieldValue: string) => {
    const field = FIELD_OPTIONS.find(f => f.value === fieldValue);
    return field?.type || 'text';
  };

  const getFieldOptions = (fieldValue: string) => {
    const field = FIELD_OPTIONS.find(f => f.value === fieldValue);
    return field?.options || [];
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Smart Segment Builder
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

        <Separator />

        {/* Rules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Segment Rules</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={addRule}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div key={rule.id} className="p-4 border rounded-lg space-y-3">
                {index > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={rule.logicalOperator || 'AND'}
                      onChange={(e) => updateRule(rule.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                      className="px-2 py-1 text-sm border rounded"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                    <span className="text-sm text-muted-foreground">this rule</span>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-4">
                  {/* Field */}
                  <div className="space-y-1">
                    <Label className="text-xs">Field</Label>
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded"
                    >
                      {FIELD_OPTIONS.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operator */}
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(rule.id, { operator: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded"
                    >
                      {OPERATOR_OPTIONS[getFieldType(rule.field) as keyof typeof OPERATOR_OPTIONS]?.map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Value */}
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    {getFieldType(rule.field) === 'select' ? (
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded"
                      >
                        {getFieldOptions(rule.field).map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : getFieldType(rule.field) === 'date' ? (
                      <Input
                        type={rule.operator.includes('days') ? 'number' : 'date'}
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                        className="text-sm"
                      />
                    ) : (
                      <Input
                        type={getFieldType(rule.field) === 'number' ? 'number' : 'text'}
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, { 
                          value: getFieldType(rule.field) === 'number' ? Number(e.target.value) : e.target.value 
                        })}
                        placeholder="Enter value"
                        className="text-sm"
                      />
                    )}
                  </div>

                  {/* Remove */}
                  <div className="space-y-1">
                    <Label className="text-xs opacity-0">Remove</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeRule(rule.id)}
                      disabled={rules.length === 1}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
  );
};