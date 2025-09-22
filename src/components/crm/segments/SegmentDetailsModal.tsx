import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Plus, X, Users, Target } from 'lucide-react';
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

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

interface SegmentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: Segment | null;
  onSegmentUpdate?: () => void;
}

export const SegmentDetailsModal: React.FC<SegmentDetailsModalProps> = ({
  open,
  onOpenChange,
  segment,
  onSegmentUpdate
}) => {
  const [segmentCustomers, setSegmentCustomers] = useState<Customer[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingCustomers, setAddingCustomers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && segment) {
      loadSegmentData();
    }
  }, [open, segment]);

  const loadSegmentData = async () => {
    if (!segment) return;
    
    setLoading(true);
    try {
      // For predefined segments, we need to handle customer assignment differently
      // Check if this is a predefined segment (no database ID) or custom segment
      const isCustomSegment = segment.id.length > 10; // Custom segments have UUID format
      
      let customers: Customer[] = [];
      
      if (isCustomSegment) {
        // Get customers assigned to custom segment via crm_segments table
        const { data: segmentCustomerData, error: segmentError } = await supabase
          .from('customer_segments')
          .select(`
            customer_id,
            crm_customers(id, email, first_name, last_name, phone, total_spent)
          `)
          .eq('segment_id', segment.id);

        if (segmentError) throw segmentError;
        customers = segmentCustomerData?.map(item => item.crm_customers).filter(Boolean) || [];
      } else {
        // For predefined segments, get customers that match the segment criteria
        // This would need to be implemented based on segment logic
        // For now, show empty list with message
        customers = [];
      }
      
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

    const isCustomSegment = segment.id.length > 10; // Custom segments have UUID format
    
    if (!isCustomSegment) {
      toast({
        title: "Not Available",
        description: "Manual assignment is only available for custom segments",
        variant: "destructive",
      });
      return;
    }

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

    const isCustomSegment = segment.id.length > 10; // Custom segments have UUID format
    
    if (!isCustomSegment) {
      toast({
        title: "Not Available",
        description: "Manual assignment is only available for custom segments",
        variant: "destructive",
      });
      return;
    }

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

  const isCustomSegment = segment?.id.length > 10; // Custom segments have UUID format

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">{segment.name}</DialogTitle>
              {segment.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {segment.description}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary Section */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-semibold">{segmentCustomers.length} Customers</span>
            </div>
            {segment.auto_update && (
              <Badge variant="outline">Auto-update</Badge>
            )}
            <div className="text-xs text-muted-foreground ml-auto">
              Created {new Date(segment.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Customer Management */}
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Manage Customers</h3>
              {isCustomSegment ? (
                <Button 
                  onClick={() => setAddingCustomers(!addingCustomers)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customers
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Automatic Assignment Only
                </Badge>
              )}
            </div>

            {!isCustomSegment && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  This is a predefined segment. Customers are automatically assigned based on their purchase behavior and cannot be manually managed.
                </p>
              </div>
            )}

            {addingCustomers && isCustomSegment && (
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
                  {isCustomSegment ? (
                    <p className="text-sm">Click "Add Customers" to get started</p>
                  ) : (
                    <p className="text-sm">Customers will appear automatically based on their purchase behavior</p>
                  )}
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
                        disabled={!isCustomSegment}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};