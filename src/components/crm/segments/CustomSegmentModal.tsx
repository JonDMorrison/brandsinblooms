import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Plus, X, Users, Target, Settings, Loader2 } from 'lucide-react';
import { CustomSegmentBuilder } from '@/components/crm/CustomSegmentBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  total_spent?: number;
}

interface CustomSegmentModalProps {
  open: boolean;
  onSave: (segmentData: { name: string; filters: any[] }) => void;
  onCancel: () => void;
  segment?: {
    id: string;
    name: string;
    description?: string;
    conditions: any;
    customer_count: number;
    auto_update: boolean;
    created_at: string;
  } | null;
  mode?: 'create' | 'view';
  onSegmentUpdate?: () => void;
}

export const CustomSegmentModal: React.FC<CustomSegmentModalProps> = ({
  open,
  onSave,
  onCancel,
  segment,
  mode = 'create',
  onSegmentUpdate
}) => {
  const [segmentData, setSegmentData] = useState<{ name: string; filters: any[] } | null>(null);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [segmentCustomers, setSegmentCustomers] = useState<Customer[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingCustomers, setAddingCustomers] = useState(false);
  const { toast } = useToast();
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && segment && mode === 'view') {
      loadSegmentData();
    }
  }, [open, segment, mode]);

  const calculateEstimatedCount = useCallback(async (filters: any[]) => {
    // Cancel any previous abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsCalculating(true);
    try {
      // Get total customer count for estimation
      const { count, error } = await supabase
        .from('crm_customers')
        .select('*', { count: 'exact', head: true });

      // Check if this request was aborted
      if (abortController.signal.aborted) return;

      if (error) throw error;

      // If no filters, show all customers
      if (!filters || filters.length === 0) {
        setEstimatedCount(count || 0);
        return;
      }

      // Simple estimation logic - in reality this would be more sophisticated
      // For now, just show a percentage based on filter complexity
      const complexityFactor = Math.min(filters.length * 0.3, 0.8);
      const estimated = Math.round((count || 0) * (1 - complexityFactor));
      setEstimatedCount(Math.max(estimated, 1));
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Error calculating estimate:', error);
        setEstimatedCount(null);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsCalculating(false);
      }
    }
  }, []);

  const handleSegmentChange = useCallback((data: { name: string; filters: any[] }) => {
    setSegmentData(data);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the calculation by 500ms
    debounceTimerRef.current = setTimeout(() => {
      calculateEstimatedCount(data.filters);
    }, 500);
  }, [calculateEstimatedCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadSegmentData = async () => {
    if (!segment) return;
    
    setLoading(true);
    try {
      // Get customers assigned to custom segment
      const { data: segmentCustomerData, error: segmentError } = await supabase
        .from('customer_segments')
        .select(`
          customer_id,
          crm_customers(id, email, first_name, last_name, phone, total_spent)
        `)
        .eq('segment_id', segment.id);

      if (segmentError) throw segmentError;
      const customers = segmentCustomerData?.map(item => item.crm_customers).filter(Boolean) || [];
      
      setSegmentCustomers(customers as Customer[]);

      // Get all available customers for adding
      const { data: allCustomers, error: customersError } = await supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name, phone, total_spent')
        .order('email');

      if (customersError) throw customersError;

      // Filter out customers already in segment
      const customerIds = new Set(customers.map(c => c.id));
      const available = (allCustomers || []).filter(c => !customerIds.has(c.id));
      setAvailableCustomers(available);

    } catch (error) {
      console.error('Error loading segment data:', error);
      toast({
        title: "Error",
        description: "Failed to load segment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addCustomerToSegment = async (customerId: string) => {
    if (!segment) return;

    try {
      const { error } = await supabase
        .from('customer_segments')
        .insert({
          customer_id: customerId,
          segment_id: segment.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer added to segment",
      });

      loadSegmentData();
      onSegmentUpdate?.();
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer to segment",
        variant: "destructive",
      });
    }
  };

  const removeCustomerFromSegment = async (customerId: string) => {
    if (!segment) return;

    try {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('customer_id', customerId)
        .eq('segment_id', segment.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer removed from segment",
      });

      loadSegmentData();
      onSegmentUpdate?.();
    } catch (error) {
      console.error('Error removing customer:', error);
      toast({
        title: "Error",
        description: "Failed to remove customer from segment",
        variant: "destructive",
      });
    }
  };

  const filteredAvailableCustomers = availableCustomers.filter(customer =>
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (segmentData) {
      onSave(segmentData);
    }
  };

  if (mode === 'view' && !segment) return null;

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">
                {mode === 'view' ? segment?.name : 'Create Custom Segment'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === 'view' 
                  ? segment?.description || 'Custom segment details'
                  : 'Define custom criteria to segment your customers'
                }
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === 'view' && segment ? (
            <>
              {/* Summary Section */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{segmentCustomers.length} Customers</span>
                </div>
                {segment.auto_update && (
                  <Badge variant="outline">Auto-update</Badge>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  Custom Segment
                </Badge>
                <div className="text-xs text-muted-foreground ml-auto">
                  Created {new Date(segment.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Customer Management */}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Manage Customers</h3>
                  <Button 
                    onClick={() => setAddingCustomers(!addingCustomers)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Customers
                  </Button>
                </div>

                {addingCustomers && (
                  <div className="mb-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search customers to add..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filteredAvailableCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {searchTerm ? 'No customers found matching your search' : 'No customers available to add'}
                        </p>
                      ) : (
                        filteredAvailableCustomers.map(customer => (
                          <div key={customer.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                            <div>
                              <span className="font-medium">{customer.email}</span>
                              {(customer.first_name || customer.last_name) && (
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({customer.first_name} {customer.last_name})
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addCustomerToSegment(customer.id)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                {/* Current Segment Customers */}
                <div className="flex-1 overflow-y-auto">
                  <h4 className="font-medium mb-3">Current Customers ({segmentCustomers.length})</h4>
                  
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : segmentCustomers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No customers in this segment yet</p>
                      <p className="text-sm">Click "Add Customers" to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {segmentCustomers.map(customer => (
                        <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{customer.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {customer.first_name || customer.last_name 
                                ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                                : 'No name provided'
                              }
                              {customer.total_spent !== undefined && (
                                <span className="ml-2">• ${customer.total_spent.toFixed(2)} spent</span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCustomerFromSegment(customer.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Summary Section for Create Mode */}
              {segmentData && segmentData.name && (
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold flex items-center gap-2">
                      {isCalculating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Calculating...
                        </>
                      ) : estimatedCount !== null ? (
                        segmentData.filters.length === 0 ? (
                          `${estimatedCount} customers (All)`
                        ) : (
                          `~${estimatedCount} customers`
                        )
                      ) : (
                        'Calculating...'
                      )}
                    </span>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    Custom Segment
                  </Badge>
                  {segmentData.filters.length > 0 ? (
                    <Badge variant="secondary">
                      {segmentData.filters.length} {segmentData.filters.length === 1 ? 'filter' : 'filters'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      No filters (All customers)
                    </Badge>
                  )}
                </div>
              )}

              <Separator className="mb-4" />

              {/* Segment Builder */}
              <div className="flex-1 overflow-y-auto">
                <CustomSegmentBuilder 
                  onSave={handleSegmentChange} 
                  onCancel={onCancel}
                  onChange={handleSegmentChange}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={!segmentData?.name?.trim()}
                  className="min-w-[140px]"
                >
                  {!segmentData?.name?.trim() ? 'Enter Name' : 'Create Segment'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};