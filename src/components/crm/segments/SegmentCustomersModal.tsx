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
import { Search, Mail, Phone, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { format } from 'date-fns';

interface Customer {
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { tenant } = useTenant();

  const fetchSegmentCustomers = async () => {
    if (!user || !segmentId || !tenant) return;

    setLoading(true);
    try {
      let customersData: Customer[] = [];

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

      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error('Error fetching segment customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && segmentId && tenant) {
      fetchSegmentCustomers();
    }
  }, [open, segmentId, user, tenant]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer => 
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm))
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

  const getCustomerInitials = (customer: Customer) => {
    const first = customer.first_name?.[0] || '';
    const last = customer.last_name?.[0] || '';
    return first + last || customer.email[0].toUpperCase();
  };

  const getCustomerName = (customer: Customer) => {
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    return name || customer.email;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Customers in "{segmentName}"</span>
            <Badge variant="secondary">
              {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No customers found' : 'No customers in this segment'}
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? 'Try adjusting your search terms' 
                    : 'This segment doesn\'t have any customers yet'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getCustomerInitials(customer)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">
                              {getCustomerName(customer)}
                            </h4>
                            {customer.persona && (
                              <Badge variant="outline" className="text-xs">
                                {customer.persona}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                            
                            {customer.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{customer.phone}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Joined {format(new Date(customer.created_at), 'MMM yyyy')}</span>
                            </div>
                          </div>
                          
                          {customer.total_spent && customer.total_spent > 0 && (
                            <div className="mt-1">
                              <Badge variant="secondary" className="text-xs">
                                Total spent: ${customer.total_spent.toFixed(2)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
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