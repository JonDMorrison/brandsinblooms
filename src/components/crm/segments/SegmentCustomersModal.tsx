import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,  
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Mail, Phone, Calendar, Users, X, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useCustomers } from '@/hooks/useCustomers';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';
import { format } from 'date-fns';

interface SegmentCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  persona: string | null;
  persona_id: string | null;
  created_at: string;
  total_spent: number | null;
  last_purchase_date: string | null;
  tags: string[] | null;
  order_history: Json | null;
}

interface SegmentCustomersModalProps {
  open: boolean;
  onClose: () => void;
  segmentId: string;
  segmentName: string;
}

export const SegmentCustomersModal: React.FC<SegmentCustomersModalProps> = ({
  open,
  onClose,
  segmentId,
  segmentName
}) => {
  const [customers, setCustomers] = useState<SegmentCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningCustomer, setAssigningCustomer] = useState<string | null>(null);
  const [unassigningCustomer, setUnassigningCustomer] = useState<string | null>(null);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: allCustomers, isLoading: customersLoading } = useCustomers();

  // Fetch customers in this segment
  const fetchSegmentCustomers = async () => {
    if (!user || !segmentId || !tenant) return [];

    try {
      let customersData: SegmentCustomer[] = [];

      // For predefined segments, we need to calculate based on criteria
      if (['loyalty-members', 'high-value', 'new-customers', 'lapsed-customers', 'seasonal-shoppers', 'frequent-buyers'].includes(segmentId)) {
        // Get all customers and filter based on segment criteria
        const { data: allCustomers, error } = await supabase
          .from('crm_customers')
          .select('id, email, first_name, last_name, phone, persona, persona_id, created_at, total_spent, last_purchase_date, tags, order_history')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        // Apply segment-specific filtering
        switch (segmentId) {
          case 'loyalty-members':
            customersData = allCustomers?.filter(customer => 
              customer.tags && customer.tags.includes('loyalty')
            ) || [];
            break;
          case 'high-value':
            customersData = allCustomers?.filter(customer => 
              (customer.total_spent || 0) >= 500
            ) || [];
            break;
          case 'new-customers':
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            customersData = allCustomers?.filter(customer => 
              new Date(customer.created_at) >= thirtyDaysAgo
            ) || [];
            break;
          case 'lapsed-customers':
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            customersData = allCustomers?.filter(customer => 
              customer.last_purchase_date && 
              new Date(customer.last_purchase_date) <= ninetyDaysAgo
            ) || [];
            break;
          case 'frequent-buyers':
            customersData = allCustomers?.filter(customer => 
              customer.order_history && Array.isArray(customer.order_history) && 
              (customer.order_history as any[]).length >= 3
            ) || [];
            break;
          case 'seasonal-shoppers':
            customersData = allCustomers?.filter(customer => 
              customer.tags && (
                customer.tags.includes('seasonal') || 
                customer.tags.includes('holiday')
              )
            ) || [];
            break;
        }
      } else {
        // For custom segments, get customers from customer_segments table
        const { data: segmentCustomers, error } = await supabase
          .from('customer_segments')
          .select(`
            customer_id,
            crm_customers (
              id,
              email,
              first_name,
              last_name,
              phone,
              persona,
              persona_id,
              created_at,
              total_spent,
              last_purchase_date,
              tags,
              order_history
            )
          `)
          .eq('segment_id', segmentId);

        if (error) throw error;

        customersData = segmentCustomers?.map(sc => sc.crm_customers).filter(Boolean) || [];
      }

      return customersData;
    } catch (error) {
      console.error('Error fetching segment customers:', error);
      return [];
    }
  };

  // Get customers assigned to this segment
  const getFilteredSegmentCustomers = () => {
    if (!customers) return [];

    const filtered = customers.filter(customer => {
      if (!searchTerm) return true;
      
      return customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm));
    });

    return filtered;
  };

  // Get customers not assigned to this segment
  const getFilteredUnassignedCustomers = () => {
    if (!allCustomers) return [];

    const assignedCustomerIds = new Set(customers.map(c => c.id));
    const unassigned = allCustomers.filter(customer => !assignedCustomerIds.has(customer.id));

    if (!searchTerm) return unassigned;

    return unassigned.filter(customer => 
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchTerm))
    );
  };

  // Handle assigning customer to segment
  const handleAssignCustomer = async (customerId: string) => {
    if (assigningCustomer) return;
    
    setAssigningCustomer(customerId);
    
    try {
      // Create a temporary hook instance to handle the assignment
      const { data, error } = await supabase
        .from('customer_segments')
        .insert({
          customer_id: customerId,
          segment_id: segmentId
        });

      if (error) throw error;

      // Refresh the customer lists
      const segmentCustomersData = await fetchSegmentCustomers();
      setCustomers(segmentCustomersData);
    } catch (error) {
      console.error('Error assigning customer to segment:', error);
    } finally {
      setAssigningCustomer(null);
    }
  };

  // Handle removing customer from segment
  const handleUnassignCustomer = async (customerId: string) => {
    if (unassigningCustomer) return;
    
    setUnassigningCustomer(customerId);
    
    try {
      const { error } = await supabase
        .from('customer_segments')
        .delete()
        .eq('customer_id', customerId)
        .eq('segment_id', segmentId);

      if (error) throw error;

      // Refresh the customer lists
      const segmentCustomersData = await fetchSegmentCustomers();
      setCustomers(segmentCustomersData);
    } catch (error) {
      console.error('Error removing customer from segment:', error);
    } finally {
      setUnassigningCustomer(null);
    }
  };

  useEffect(() => {
    if (open && segmentId && tenant) {
      setLoading(true);
      fetchSegmentCustomers().then((data) => {
        setCustomers(data);
        setLoading(false);
      });
    }
  }, [open, segmentId, user, tenant]);

  const getCustomerInitials = (customer: SegmentCustomer | any) => {
    const first = customer.first_name?.[0] || '';
    const last = customer.last_name?.[0] || '';
    return first + last || customer.email[0].toUpperCase();
  };

  const getCustomerName = (customer: SegmentCustomer | any) => {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    return name || customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* X Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 h-6 w-6 rounded-full z-50"
        >
          <X className="h-4 w-4" />
        </Button>

        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Manage Customers in "{segmentName}"</span>
            </div>
            <Badge variant="secondary">
              {getFilteredSegmentCustomers().length} assigned
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Customer Management */}
          {loading || customersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Assigned Customers */}
              <div className="flex flex-col">
                <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                  Customers in Segment
                  <Badge variant="secondary" className="text-xs">
                    {getFilteredSegmentCustomers().length}
                  </Badge>
                </h5>
                <ScrollArea className="flex-1 border rounded-md p-2">
                  <div className="space-y-2">
                    {getFilteredSegmentCustomers().map((customer) => (
                      <Card key={customer.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getCustomerInitials(customer)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {getCustomerName(customer)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.email}
                              </p>
                              {customer.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {customer.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnassignCustomer(customer.id)}
                            disabled={unassigningCustomer === customer.id}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Remove from segment"
                          >
                            {unassigningCustomer === customer.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {getFilteredSegmentCustomers().length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? 'No customers found' : 'No customers in this segment'}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Available Customers */}
              <div className="flex flex-col">
                <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                  Available to Add
                  <Badge variant="outline" className="text-xs">
                    {getFilteredUnassignedCustomers().length}
                  </Badge>
                </h5>
                <ScrollArea className="flex-1 border rounded-md p-2">
                  <div className="space-y-2">
                    {getFilteredUnassignedCustomers().map((customer) => (
                      <Card key={customer.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getCustomerInitials(customer)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">
                                {getCustomerName(customer)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {customer.email}
                              </p>
                              {customer.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {customer.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAssignCustomer(customer.id)}
                            disabled={assigningCustomer === customer.id}
                            className="h-7 w-7 p-0"
                            title="Add to segment"
                          >
                            {assigningCustomer === customer.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {getFilteredUnassignedCustomers().length === 0 && (
                      <div className="text-center py-8">
                        <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {searchTerm ? 'No available customers found' : 'All customers are assigned'}
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};