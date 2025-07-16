import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import ConditionBuilder from '@/components/crm/segments/ConditionBuilder';
import { PersonaSegmentTemplates } from '@/components/crm/segments/PersonaSegmentTemplates';
import { 
  Plus, 
  Target, 
  Users,
  Filter,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
  Globe
} from 'lucide-react';

interface SegmentCondition {
  field: string;
  operator: string;
  value: string | string[] | Date;
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

interface CustomerPreview {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  persona: string;
  tags: string[];
}

const CRMSegments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [liveCount, setLiveCount] = useState<number>(0);
  const [customerPreview, setCustomerPreview] = useState<CustomerPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPersonaTemplates, setShowPersonaTemplates] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    auto_update: true,
    conditions: [] as SegmentCondition[]
  });

  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('');

  const prebuiltSegments = [
    {
      name: "New Garden Enthusiasts",
      description: "Customers who joined in the last 30 days",
      count: 0,
      conditions: "Created Date < 30 days",
      color: "bg-blue-100 text-blue-800"
    },
    {
      name: "High Value Customers",
      description: "Customers with lifetime value over $500",
      count: 0,
      conditions: "Lifetime Value > $500",
      color: "bg-purple-100 text-purple-800"
    }
  ];

  useEffect(() => {
    if (user) {
      loadSegments();
      loadAvailableTags();
      loadPersonas();
    }
  }, [user]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .order('name');

      if (error) throw error;
      setPersonas(data || []);
    } catch (error) {
      console.error('Error loading personas:', error);
    }
  };

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

  // Enhanced segment count calculation with all new filter types
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

      // Apply conditions with enhanced support
      conditions.forEach(condition => {
        switch (condition.field) {
          case 'persona':
            query = query.eq('persona', condition.value as string);
            break;
          case 'persona_id':
            query = query.eq('persona_id', condition.value as string);
            break;
          case 'sms_opt_in':
            query = query.eq('sms_opt_in', condition.value === 'true');
            break;
          case 'lifetime_value':
            if (condition.operator === 'greater_than') {
              query = query.gte('lifetime_value', parseFloat(condition.value as string));
            } else if (condition.operator === 'less_than') {
              query = query.lte('lifetime_value', parseFloat(condition.value as string));
            } else if (condition.operator === 'equals') {
              query = query.eq('lifetime_value', parseFloat(condition.value as string));
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
          case 'created_at':
            if (condition.operator === 'after') {
              query = query.gte('created_at', (condition.value as Date).toISOString());
            } else if (condition.operator === 'before') {
              query = query.lte('created_at', (condition.value as Date).toISOString());
            }
            break;
          case 'last_purchase_date':
            if (condition.operator === 'after') {
              query = query.gte('last_purchase_date', (condition.value as Date).toISOString().split('T')[0]);
            } else if (condition.operator === 'before') {
              query = query.lte('last_purchase_date', (condition.value as Date).toISOString().split('T')[0]);
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

  // Load customer preview for segment
  const loadCustomerPreview = async (conditions: SegmentCondition[]) => {
    if (conditions.length === 0) {
      setCustomerPreview([]);
      return;
    }

    setPreviewLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      let query = supabase
        .from('crm_customers')
        .select('id, first_name, last_name, email, persona, tags')
        .eq('tenant_id', userData.tenant_id)
        .limit(5);

      // Apply same conditions as count
      conditions.forEach(condition => {
        switch (condition.field) {
          case 'persona':
            query = query.eq('persona', condition.value as string);
            break;
          case 'persona_id':
            query = query.eq('persona_id', condition.value as string);
            break;
          case 'sms_opt_in':
            query = query.eq('sms_opt_in', condition.value === 'true');
            break;
          case 'lifetime_value':
            if (condition.operator === 'greater_than') {
              query = query.gte('lifetime_value', parseFloat(condition.value as string));
            } else if (condition.operator === 'less_than') {
              query = query.lte('lifetime_value', parseFloat(condition.value as string));
            } else if (condition.operator === 'equals') {
              query = query.eq('lifetime_value', parseFloat(condition.value as string));
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
          case 'created_at':
            if (condition.operator === 'after') {
              query = query.gte('created_at', (condition.value as Date).toISOString());
            } else if (condition.operator === 'before') {
              query = query.lte('created_at', (condition.value as Date).toISOString());
            }
            break;
          case 'last_purchase_date':
            if (condition.operator === 'after') {
              query = query.gte('last_purchase_date', (condition.value as Date).toISOString().split('T')[0]);
            } else if (condition.operator === 'before') {
              query = query.lte('last_purchase_date', (condition.value as Date).toISOString().split('T')[0]);
            }
            break;
        }
      });

      const { data, error } = await query;
      if (error) throw error;
      
      setCustomerPreview(data || []);
    } catch (error) {
      console.error('Error loading customer preview:', error);
      setCustomerPreview([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Update live count and preview when conditions change
  useEffect(() => {
    const updatePreview = async () => {
      if (formData.conditions.length > 0) {
        const count = await calculateSegmentCount(formData.conditions);
        setLiveCount(count);
        await loadCustomerPreview(formData.conditions);
      } else {
        setLiveCount(0);
        setCustomerPreview([]);
      }
    };

    updatePreview();
  }, [formData.conditions]);

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

  const handlePersonaSelect = (persona: any) => {
    setFormData({
      name: `${persona.name} Customers`,
      description: `Customers who match the ${persona.name} persona profile`,
      auto_update: true,
      conditions: [
        {
          field: 'persona_id',
          operator: 'equals',
          value: persona.id,
          logic: 'AND' as const
        }
      ]
    });
    setShowSegmentForm(true);
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

                {/* Enhanced Rule Builder */}
                <ConditionBuilder
                  conditions={formData.conditions}
                  availableTags={availableTags}
                  onAddCondition={addCondition}
                  onUpdateCondition={updateCondition}
                  onRemoveCondition={removeCondition}
                />

                 {/* Live Segment Preview */}
                 {formData.conditions.length > 0 && (
                   <div className="space-y-4">
                     <div className="flex items-center gap-2">
                       <Eye className="h-4 w-4 text-primary" />
                       <Label className="text-base font-semibold">Live Preview</Label>
                     </div>
                     
                     <Card className="bg-garden-green/5 border-garden-green/20">
                       <CardContent className="p-4">
                         <div className="flex items-center justify-between mb-4">
                           <div>
                             <h3 className="font-semibold text-garden-green">
                               {liveCount} customers match this segment
                             </h3>
                             <p className="text-sm text-muted-foreground">
                               {formData.auto_update ? 
                                 "Automatically includes future customers who match these conditions" :
                                 "Static segment - will not update automatically"
                               }
                             </p>
                           </div>
                           <Badge variant="outline" className="bg-background">
                             <Target className="h-3 w-3 mr-1" />
                             {liveCount} matches
                           </Badge>
                         </div>

                         {/* Customer Preview Cards */}
                         {customerPreview.length > 0 && (
                           <div className="space-y-3">
                             <Label className="text-sm font-medium text-muted-foreground">
                               Sample customers (first 5):
                             </Label>
                             <div className="space-y-2">
                               {customerPreview.map((customer) => (
                                 <div key={customer.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                   <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-garden-green/10 flex items-center justify-center">
                                       <Users className="h-4 w-4 text-garden-green" />
                                     </div>
                                     <div>
                                       <div className="font-medium text-sm">
                                         {customer.first_name} {customer.last_name}
                                       </div>
                                       <div className="text-xs text-muted-foreground">
                                         {customer.email}
                                       </div>
                                     </div>
                                   </div>
                                   <div className="flex items-center gap-2">
                                     <Badge variant="secondary" className="text-xs">
                                       {customer.persona}
                                     </Badge>
                                     {customer.tags && customer.tags.length > 0 && (
                                       <div className="flex gap-1">
                                         {customer.tags.slice(0, 2).map((tag, idx) => (
                                           <Badge key={idx} variant="outline" className="text-xs">
                                             {tag}
                                           </Badge>
                                         ))}
                                         {customer.tags.length > 2 && (
                                           <Badge variant="outline" className="text-xs">
                                             +{customer.tags.length - 2}
                                           </Badge>
                                         )}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}

                         {previewLoading && (
                           <div className="flex items-center justify-center py-4">
                             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-garden-green"></div>
                             <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
                           </div>
                         )}

                         {customerPreview.length === 0 && !previewLoading && (
                           <div className="text-center py-6 text-muted-foreground">
                             <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                             <p className="text-sm">No customers match these conditions yet</p>
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   </div>
                 )}

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