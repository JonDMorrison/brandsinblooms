import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit2, Save, Mail, MessageSquare, Package, Calendar, DollarSign, Tags, User } from "lucide-react";
import { PersonaSelector } from "@/components/crm/personas/PersonaSelector";

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pos_source: string | null;
  total_spent: number | null;
  last_purchase_date: string | null;
  tags: string[] | null;
  sms_opt_in: boolean | null;
  persona_id: string | null;
  created_at: string;
}

interface TimelineActivity {
  id: string;
  activity_type: string;
  campaign_name: string | null;
  purchase_amount: number | null;
  product_name: string | null;
  metadata: any;
  created_at: string;
}

const CustomerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>({});

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_customers')
        .select(`
          *,
          personas!crm_customers_persona_id_fkey(
            id,
            name,
            tone,
            description,
            icon,
            color_theme
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Customer & { personas?: any };
    },
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['customer-timeline', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_timeline')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TimelineActivity[];
    },
    enabled: !!id,
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: Partial<Customer>) => {
      const { data, error } = await supabase
        .from('crm_customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast({ title: "Customer updated successfully" });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({ 
        title: "Error updating customer", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  useEffect(() => {
    if (customer && !editedCustomer.id) {
      setEditedCustomer(customer);
    }
  }, [customer, editedCustomer.id]);

  const handleSave = () => {
    updateCustomerMutation.mutate(editedCustomer);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email_sent':
        return <Mail className="w-4 h-4 text-primary" />;
      case 'sms_sent':
        return <MessageSquare className="w-4 h-4 text-secondary" />;
      case 'purchase':
        return <Package className="w-4 h-4 text-green-600" />;
      default:
        return <Calendar className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatActivity = (activity: TimelineActivity) => {
    switch (activity.activity_type) {
      case 'email_sent':
        return `Email sent: ${activity.campaign_name}`;
      case 'sms_sent':
        return `SMS sent: ${activity.campaign_name}`;
      case 'purchase':
        return `Purchased ${activity.product_name} for $${activity.purchase_amount}`;
      default:
        return activity.activity_type;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-center">Customer not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/customers')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Button>
          <h1 className="text-2xl font-bold">
            {customer.first_name} {customer.last_name}
          </h1>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateCustomerMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Overview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={editedCustomer.first_name || ''}
                      onChange={(e) => setEditedCustomer(prev => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={editedCustomer.last_name || ''}
                      onChange={(e) => setEditedCustomer(prev => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editedCustomer.email || ''}
                      onChange={(e) => setEditedCustomer(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editedCustomer.phone || ''}
                      onChange={(e) => setEditedCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{customer.email}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.pos_source && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="secondary">{customer.pos_source}</Badge>
                    </div>
                  )}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="w-3 h-3" />
                        Lifetime Value
                      </div>
                      <div className="font-semibold">
                        ${customer.total_spent?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Last Purchase
                      </div>
                      <div className="font-semibold">
                        {customer.last_purchase_date 
                          ? new Date(customer.last_purchase_date).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>
                  {customer.tags && customer.tags.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-2">
                          <Tags className="w-3 h-3" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Persona Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer Persona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PersonaSelector
                value={customer.persona_id}
                onChange={(personaId) => {
                  updateCustomerMutation.mutate({ persona_id: personaId });
                }}
                customerId={customer.id}
                showFullCard={true}
              />
            </CardContent>
          </Card>
        </div>

        {/* Timeline Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activities recorded yet
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      {getActivityIcon(activity.activity_type)}
                      <div className="flex-1">
                        <div className="font-medium">
                          {formatActivity(activity)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;