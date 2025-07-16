import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { 
  Plus, 
  Target, 
  Users,
  Filter,
  Calendar,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  Settings
} from 'lucide-react';

interface SegmentCondition {
  field: string;
  operator: string;
  value: string | string[];
  logic?: 'AND' | 'OR';
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any; // JSON from database
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

const CRMSegments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    auto_update: true,
    conditions: [] as SegmentCondition[]
  });

  const prebuiltSegments = [
    {
      name: "New Garden Enthusiasts",
      description: "Customers who joined in the last 30 days with 'Newbie' persona",
      count: 0,
      conditions: "Persona = Newbie AND Created Date < 30 days",
      color: "bg-blue-100 text-blue-800"
    },
    {
      name: "High Value Regulars",
      description: "Regular customers with lifetime value over $500",
      count: 0,
      conditions: "Persona = Regular AND Lifetime Value > $500",
      color: "bg-purple-100 text-purple-800"
    }
  ];

  useEffect(() => {
    if (user) {
      loadSegments();
      loadAvailableTags();
    }
  }, [user]);

  const loadSegments = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_segments')
          .select('*')
          .eq('tenant_id', userData.tenant_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        // Parse conditions from JSON and ensure they're arrays
        const parsedSegments = data?.map(segment => ({
          ...segment,
          conditions: Array.isArray(segment.conditions) ? segment.conditions : []
        })) || [];
        setSegments(parsedSegments);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
      toast({
        title: "Error",
        description: "Failed to load segments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_customers')
          .select('tags')
          .eq('tenant_id', userData.tenant_id)
          .not('tags', 'is', null);

        if (error) throw error;
        
        const allTags = new Set<string>();
        data?.forEach(customer => {
          if (customer.tags) {
            customer.tags.forEach((tag: string) => allTags.add(tag));
          }
        });
        
        setAvailableTags(Array.from(allTags));
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const calculateSegmentCount = async (conditions: SegmentCondition[]) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return 0;

      let query = supabase
        .from('crm_customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', userData.tenant_id);

      // Apply conditions
      conditions.forEach(condition => {
        switch (condition.field) {
          case 'persona':
            query = query.eq('persona', condition.value as string);
            break;
          case 'sms_opt_in':
            query = query.eq('sms_opt_in', condition.value === 'true');
            break;
          case 'lifetime_value':
            if (condition.operator === 'greater_than') {
              query = query.gte('lifetime_value', parseFloat(condition.value as string));
            } else if (condition.operator === 'less_than') {
              query = query.lte('lifetime_value', parseFloat(condition.value as string));
            }
            break;
          case 'email':
            if (condition.operator === 'contains') {
              query = query.ilike('email', `%${condition.value}%`);
            }
            break;
            case 'tags':
            if (condition.operator === 'includes') {
              const tagValue = Array.isArray(condition.value) ? condition.value : [condition.value];
              query = query.contains('tags', tagValue);
            }
            break;
        }
      });

      const { count, error } = await query;
      if (error) throw error;
      
      return count || 0;
    } catch (error) {
      console.error('Error calculating segment count:', error);
      return 0;
    }
  };

  const saveSegment = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Segment name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      const customerCount = await calculateSegmentCount(formData.conditions);

      const segmentData = {
        name: formData.name,
        description: formData.description || null,
        conditions: formData.conditions as any, // Cast to JSON for database
        customer_count: customerCount,
        auto_update: formData.auto_update,
        tenant_id: userData.tenant_id,
        user_id: user?.id
      };

      let error;
      if (editingSegment) {
        const { error: updateError } = await supabase
          .from('crm_segments')
          .update(segmentData)
          .eq('id', editingSegment.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('crm_segments')
          .insert(segmentData);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: `Segment ${editingSegment ? 'updated' : 'created'} successfully`
      });

      setShowSegmentForm(false);
      setEditingSegment(null);
      setFormData({
        name: '',
        description: '',
        auto_update: true,
        conditions: []
      });
      loadSegments();
    } catch (error) {
      console.error('Error saving segment:', error);
      toast({
        title: "Error",
        description: `Failed to ${editingSegment ? 'update' : 'create'} segment`,
        variant: "destructive"
      });
    }
  };

  const deleteSegment = async (segmentId: string) => {
    try {
      const { error } = await supabase
        .from('crm_segments')
        .delete()
        .eq('id', segmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Segment deleted successfully"
      });

      loadSegments();
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast({
        title: "Error",
        description: "Failed to delete segment",
        variant: "destructive"
      });
    }
  };

  const refreshSegmentCount = async (segment: Segment) => {
    try {
      const conditions = Array.isArray(segment.conditions) ? segment.conditions : [];
      const newCount = await calculateSegmentCount(conditions);
      
      const { error } = await supabase
        .from('crm_segments')
        .update({ customer_count: newCount })
        .eq('id', segment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Segment count updated"
      });

      loadSegments();
    } catch (error) {
      console.error('Error refreshing segment:', error);
      toast({
        title: "Error",
        description: "Failed to refresh segment count",
        variant: "destructive"
      });
    }
  };

  const openEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || '',
      auto_update: segment.auto_update,
      conditions: Array.isArray(segment.conditions) ? segment.conditions : []
    });
    setShowSegmentForm(true);
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        { field: 'persona', operator: 'equals', value: '', logic: 'AND' }
      ]
    }));
  };

  const updateCondition = (index: number, updates: Partial<SegmentCondition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, ...updates } : condition
      )
    }));
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Customer Segmentation"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Segments</h1>
            <p className="text-muted-foreground">
              Create targeted customer groups for personalized campaigns
            </p>
          </div>
          <Dialog open={showSegmentForm} onOpenChange={setShowSegmentForm}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingSegment(null);
                setFormData({
                  name: '',
                  description: '',
                  auto_update: true,
                  conditions: []
                });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Segment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSegment ? 'Edit Segment' : 'Create New Segment'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Segment Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., High Value Spring Shoppers"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this segment represents..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto_update"
                      checked={formData.auto_update}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, auto_update: checked as boolean }))
                      }
                    />
                    <Label htmlFor="auto_update">Auto-Update (recommended)</Label>
                  </div>
                </div>

                {/* Rule Builder */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Segment Rules</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Rule
                    </Button>
                  </div>
                  
                  {formData.conditions.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                      <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No rules added yet</p>
                      <p className="text-sm text-muted-foreground">Add rules to define your segment</p>
                    </div>
                  )}

                  {formData.conditions.map((condition, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      {index > 0 && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={condition.logic}
                            onValueChange={(value) => updateCondition(index, { logic: value as 'AND' | 'OR' })}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Field</Label>
                          <Select
                            value={condition.field}
                            onValueChange={(value) => updateCondition(index, { field: value, value: '' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="persona">Persona</SelectItem>
                              <SelectItem value="tags">Tags</SelectItem>
                              <SelectItem value="sms_opt_in">SMS Opt-In</SelectItem>
                              <SelectItem value="lifetime_value">Lifetime Value</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Operator</Label>
                          <Select
                            value={condition.operator}
                            onValueChange={(value) => updateCondition(index, { operator: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {condition.field === 'persona' && (
                                <SelectItem value="equals">is</SelectItem>
                              )}
                              {condition.field === 'tags' && (
                                <SelectItem value="includes">includes</SelectItem>
                              )}
                              {condition.field === 'sms_opt_in' && (
                                <SelectItem value="equals">is</SelectItem>
                              )}
                              {condition.field === 'lifetime_value' && (
                                <>
                                  <SelectItem value="greater_than">greater than</SelectItem>
                                  <SelectItem value="less_than">less than</SelectItem>
                                </>
                              )}
                              {condition.field === 'email' && (
                                <SelectItem value="contains">contains</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Value</Label>
                          {condition.field === 'persona' && (
                            <Select
                              value={condition.value as string}
                              onValueChange={(value) => updateCondition(index, { value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select persona" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Newbie">Newbie</SelectItem>
                                <SelectItem value="Struggler">Struggler</SelectItem>
                                <SelectItem value="Regular">Regular</SelectItem>
                                <SelectItem value="Expert">Expert</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          
                          {condition.field === 'sms_opt_in' && (
                            <Select
                              value={condition.value as string}
                              onValueChange={(value) => updateCondition(index, { value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          
                          {(condition.field === 'lifetime_value' || condition.field === 'email') && (
                            <Input
                              value={condition.value as string}
                              onChange={(e) => updateCondition(index, { value: e.target.value })}
                              placeholder={condition.field === 'lifetime_value' ? "Amount" : "Text to search"}
                            />
                          )}
                        </div>
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCondition(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowSegmentForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveSegment}>
                    {editingSegment ? 'Update' : 'Create'} Segment
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Custom Segments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Segments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading segments...</p>
              </div>
            ) : segments.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No segments yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first segment to start organizing customers
                </p>
                <Button onClick={() => setShowSegmentForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Segment
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Customer Count</TableHead>
                    <TableHead>Auto-Update</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((segment) => (
                    <TableRow key={segment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{segment.name}</div>
                          {segment.description && (
                            <div className="text-sm text-muted-foreground">{segment.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{segment.customer_count}</span>
                          {segment.auto_update && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => refreshSegmentCount(segment)}
                              className="h-6 w-6 p-0"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={segment.auto_update ? "default" : "secondary"}>
                          {segment.auto_update ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(segment.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditSegment(segment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSegment(segment.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pre-built Segments */}
        {prebuiltSegments.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Garden Center Templates
                </CardTitle>
                <Badge variant="outline">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {prebuiltSegments.map((segment, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 opacity-60">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground">{segment.name}</h3>
                        <p className="text-sm text-muted-foreground">{segment.description}</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Create Similar
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                        {segment.conditions}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SubscriptionGate>
  );
};

export default CRMSegments;