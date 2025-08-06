import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Filter, ShoppingBag, Calendar, Package } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';

interface PosOrder {
  id: string;
  external_id: string;
  order_date: string;
  total_amount: number;
  currency: string;
  items: Array<{
    name: string;
    category?: string;
    quantity: number;
    price?: number;
  }>;
  status: string;
}

interface CustomerTimelineProps {
  customerId: string;
}

export const CustomerTimeline = ({ customerId }: CustomerTimelineProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');

  // Fetch customer orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      // Get customer email to match with POS orders
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('email')
        .eq('id', customerId)
        .single();

      if (!customer) return [];

      const { data, error } = await supabase
        .from('pos_orders')
        .select('*')
        .eq('external_customer_id', customer.email)
        .order('order_date', { ascending: false });

      if (error) throw error;
      return data as unknown as PosOrder[];
    },
  });

  // Get available years for filter
  const availableYears = Array.from(
    new Set(orders.map(order => new Date(order.order_date).getFullYear()))
  ).sort((a, b) => b - a);

  // Filter orders based on search and filters
  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.items.some(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      order.external_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesYear = selectedYear === 'all' || 
      new Date(order.order_date).getFullYear().toString() === selectedYear;

    // For now, all orders are from POS channel, but this can be extended
    const matchesChannel = selectedChannel === 'all' || selectedChannel === 'pos';

    return matchesSearch && matchesYear && matchesChannel;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'fulfilled':
        return 'bg-emerald-500 text-white';
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Order Timeline ({filteredOrders.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters</span>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search orders, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[120px]"
          >
            <option value="all">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year.toString()}>{year}</option>
            ))}
          </select>

          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[120px]"
          >
            <option value="all">All Channels</option>
            <option value="pos">POS</option>
            <option value="web">Web</option>
          </select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery || selectedYear !== 'all' || selectedChannel !== 'all'
                ? 'No orders match your filters'
                : 'No orders found'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order, index) => (
              <div key={order.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(order.order_date), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({formatDistanceToNow(new Date(order.order_date), { addSuffix: true })})
                        </span>
                      </div>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status || 'Completed'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Order #{order.external_id}</p>
                        <p className="font-semibold text-lg">
                          {formatCurrency(order.total_amount, order.currency)}
                        </p>
                      </div>
                      <Badge variant="outline">POS</Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Items ({order.items.length})</p>
                      <div className="grid gap-2">
                        {order.items.slice(0, 3).map((item, itemIndex) => (
                          <div key={itemIndex} className="flex items-center justify-between text-sm bg-muted/50 rounded p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {item.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              {item.price && (
                                <span>{formatCurrency(item.price * item.quantity)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{order.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {index < filteredOrders.length - 1 && (
                  <Separator className="my-6" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};