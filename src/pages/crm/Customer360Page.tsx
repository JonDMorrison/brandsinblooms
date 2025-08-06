import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MessageSquare, 
  Plus, 
  Download,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Filter
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { CustomerTimeline } from '@/components/crm/customer360/CustomerTimeline';
import { CustomerInsights } from '@/components/crm/customer360/CustomerInsights';
import { CustomerActivity } from '@/components/crm/customer360/CustomerActivity';
import { SendSMSDialog } from '@/components/crm/customer360/SendSMSDialog';
import { AddToSegmentDialog } from '@/components/crm/customer360/AddToSegmentDialog';

interface Customer360Data {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pos_source: string | null;
  enriched_total_spent: number;
  order_count: number;
  last_order_date: string | null;
  first_order_date: string | null;
  avg_order_value: number | null;
  loyalty_status: string;
  customer_status: string;
  favorite_products: string | null;
  product_categories: string | null;
  tags: string[] | null;
  custom_fields: any;
  created_at: string;
}

const Customer360Page = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showSendSMS, setShowSendSMS] = useState(false);
  const [showAddToSegment, setShowAddToSegment] = useState(false);

  // Fetch customer 360 data
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer-360', id],
    queryFn: async () => {
      if (!id) throw new Error('Customer ID required');
      
      const { data, error } = await supabase
        .from('customer_360_enriched')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Customer360Data;
    },
    enabled: !!id,
  });

  const getInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getFullName = (firstName: string | null, lastName: string | null) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    return 'Unknown Name';
  };

  const getLoyaltyStatusColor = (status: string) => {
    switch (status) {
      case 'VIP':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'Loyal':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      case 'Regular':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCustomerStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-500 text-white';
      case 'At Risk':
        return 'bg-warning text-warning-foreground';
      case 'Churned':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleExportCustomer = async () => {
    if (!customer) return;
    
    const csvData = [
      ['Field', 'Value'],
      ['Name', getFullName(customer.first_name, customer.last_name)],
      ['Email', customer.email],
      ['Phone', customer.phone || ''],
      ['Total Spent', formatCurrency(customer.enriched_total_spent)],
      ['Order Count', customer.order_count.toString()],
      ['Loyalty Status', customer.loyalty_status],
      ['Customer Status', customer.customer_status],
      ['POS Source', customer.pos_source || ''],
      ['First Order', customer.first_order_date ? format(new Date(customer.first_order_date), 'MMM dd, yyyy') : ''],
      ['Last Order', customer.last_order_date ? format(new Date(customer.last_order_date), 'MMM dd, yyyy') : ''],
      ['Avg Order Value', customer.avg_order_value ? formatCurrency(customer.avg_order_value) : ''],
      ['Favorite Products', customer.favorite_products || ''],
      ['Product Categories', customer.product_categories || ''],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-${customer.email.replace('@', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Customer Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The customer you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate('/crm/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/crm/customers')}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Customer Profile</h1>
      </div>

      {/* Customer Summary Card */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg font-semibold">
                  {getInitials(customer.first_name, customer.last_name, customer.email)}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">
                  {getFullName(customer.first_name, customer.last_name)}
                </h2>
                <p className="text-muted-foreground">{customer.email}</p>
                {customer.phone && (
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendSMS(true)}
                disabled={!customer.phone}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Send SMS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddToSegment(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Segment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCustomer}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Spent</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(customer.enriched_total_spent)}
              </p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Orders</p>
              <p className="text-2xl font-bold">{customer.order_count}</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Loyalty Status</p>
              <Badge className={getLoyaltyStatusColor(customer.loyalty_status)}>
                {customer.loyalty_status}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getCustomerStatusColor(customer.customer_status)}>
                {customer.customer_status}
              </Badge>
            </div>
          </div>

          {customer.pos_source && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {customer.pos_source}
                </Badge>
                <span className="text-sm text-muted-foreground">POS Source</span>
              </div>
            </div>
          )}

          {(customer.favorite_products || customer.product_categories) && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {customer.favorite_products && (
                <div>
                  <p className="text-sm font-medium">Favorite Products</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {customer.favorite_products}
                  </p>
                </div>
              )}
              {customer.product_categories && (
                <div>
                  <p className="text-sm font-medium">Product Categories</p>
                  <p className="text-sm text-muted-foreground">
                    {customer.product_categories}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Order Timeline
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Messages & Automations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <CustomerTimeline customerId={customer.id} />
        </TabsContent>

        <TabsContent value="insights">
          <CustomerInsights customer={customer} />
        </TabsContent>

        <TabsContent value="activity">
          <CustomerActivity customerId={customer.id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showSendSMS && (
        <SendSMSDialog
          customer={customer}
          open={showSendSMS}
          onClose={() => setShowSendSMS(false)}
        />
      )}

      {showAddToSegment && (
        <AddToSegmentDialog
          customer={customer}
          open={showAddToSegment}
          onClose={() => setShowAddToSegment(false)}
        />
      )}
    </div>
  );
};

export default Customer360Page;