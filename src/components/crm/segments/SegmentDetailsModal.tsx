import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Target, Search, Plus, X, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BulkCustomerImportDialog } from './BulkCustomerImportDialog';

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
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
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
      const isCustomSegment = segment.id.length > 10; // Custom segments have UUID format
      
      let customers: Customer[] = [];
      
      if (isCustomSegment) {
        // Get customers assigned to custom segment
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
        // For predefined segments, show empty for now
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
    if (!segment || loadingCustomerId) return;

    const isCustomSegment = segment.id.length > 10;
    
    if (!isCustomSegment) {
      return;
    }

    setLoadingCustomerId(customerId);

    try {
      const { error } = await supabase
        .from('customer_segments')
        .insert({
          customer_id: customerId,
          segment_id: segment.id
        });

      if (error) throw error;

      // Update local state
      const customerToMove = availableCustomers.find(c => c.id === customerId);
      if (customerToMove) {
        setSegmentCustomers(prev => [...prev, customerToMove]);
        setAvailableCustomers(prev => prev.filter(c => c.id !== customerId));
      }

    } catch (error) {
      console.error('Error adding customer:', error);
    } finally {
      setLoadingCustomerId(null);
    }
  };

  const removeCustomerFromSegment = async (customerId: string) => {
    if (!segment || loadingCustomerId) return;

    const isCustomSegment = segment.id.length > 10;
    
    if (!isCustomSegment) {
      return;
    }

    setLoadingCustomerId(customerId);

    try {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('customer_id', customerId)
        .eq('segment_id', segment.id);

      if (error) throw error;

      // Update local state
      const customerToMove = segmentCustomers.find(c => c.id === customerId);
      if (customerToMove) {
        setAvailableCustomers(prev => [...prev, customerToMove]);
        setSegmentCustomers(prev => prev.filter(c => c.id !== customerId));
      }

    } catch (error) {
      console.error('Error removing customer:', error);
    } finally {
      setLoadingCustomerId(null);
    }
  };

  const bulkAddCustomers = async (customerIds: string[]) => {
    if (!segment || customerIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('customer_segments')
        .insert(
          customerIds.map(id => ({
            customer_id: id,
            segment_id: segment.id
          }))
        );

      if (error) throw error;

      // Update local state
      const customersToMove = availableCustomers.filter(c => customerIds.includes(c.id));
      setSegmentCustomers(prev => [...prev, ...customersToMove]);
      setAvailableCustomers(prev => prev.filter(c => !customerIds.includes(c.id)));

    } catch (error) {
      console.error('Error bulk adding customers:', error);
      throw error;
    }
  };

  const filteredAvailableCustomers = availableCustomers.filter(customer =>
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCustomSegment = segment?.id.length > 10;

  if (!segment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
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

        <div className="flex flex-col gap-4">
          {/* Summary Section */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
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

          {/* Search Bar */}
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {!isCustomSegment && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This is a predefined segment. Customers are automatically assigned based on their purchase behavior and cannot be manually managed.
              </p>
            </div>
          )}

          {/* Two Column Layout */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-2 gap-6 h-full">
              {/* Left Column - Assigned Customers */}
              <div className="flex flex-col">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Customers ({segmentCustomers.length})
                </h3>
                
                <div className="flex-1 overflow-y-auto border rounded-lg">
                  {loading ? (
                    <div className="space-y-2 p-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : segmentCustomers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground p-4">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No customers assigned yet</p>
                      {isCustomSegment && (
                        <p className="text-sm">Add customers from the available list</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2">
                      {segmentCustomers.map(customer => (
                        <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{customer.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {customer.first_name || customer.last_name 
                                ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                                : 'No name provided'
                              }
                              {customer.total_spent !== undefined && (
                                <span className="ml-2">• ${customer.total_spent.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          {isCustomSegment && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                removeCustomerFromSegment(customer.id);
                              }}
                              disabled={loadingCustomerId === customer.id}
                              className="text-destructive hover:text-destructive flex-shrink-0 ml-2"
                            >
                              {loadingCustomerId === customer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Available Customers */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Available Customers ({filteredAvailableCustomers.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {isCustomSegment && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowBulkImport(true)}
                        className="gap-2"
                      >
                        <Upload className="h-3 w-3" />
                        Bulk Import
                      </Button>
                    )}
                    {!isCustomSegment && (
                      <Badge variant="secondary" className="text-xs">
                        View Only
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border rounded-lg">
                  {filteredAvailableCustomers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground p-4">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{searchTerm ? 'No customers found matching your search' : 'No customers available to add'}</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredAvailableCustomers.map(customer => (
                        <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{customer.email}</div>
                            <div className="text-sm text-muted-foreground">
                              {(customer.first_name || customer.last_name) ? (
                                <span>({customer.first_name} {customer.last_name})</span>
                              ) : (
                                'No name provided'
                              )}
                              {customer.total_spent !== undefined && (
                                <span className="ml-2">• ${customer.total_spent.toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                          {isCustomSegment && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addCustomerToSegment(customer.id);
                              }}
                              disabled={loadingCustomerId === customer.id}
                              className="flex-shrink-0 ml-2"
                            >
                              {loadingCustomerId === customer.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t mt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Close button clicked');
                onOpenChange(false);
              }}
              className="px-6"
            >
              Close
            </Button>
          </div>
        </div>

        {/* Bulk Import Dialog */}
        <BulkCustomerImportDialog
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          onImport={bulkAddCustomers}
          availableCustomers={availableCustomers}
        />
      </DialogContent>
    </Dialog>
  );
};