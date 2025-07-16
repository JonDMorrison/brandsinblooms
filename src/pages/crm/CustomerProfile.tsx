import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { PersonaModal } from '@/components/crm/personas/PersonaModal';
import { PersonaSummaryCard } from '@/components/crm/customers/PersonaSummaryCard';
import { 
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ShoppingBag,
  Tag,
  Target,
  User,
  Edit,
  Sparkles
} from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  total_spent: number;
  lifetime_value: number;
  last_purchase_date: string;
  tags: string[];
  persona: string;
  persona_id: string;
  persona_confidence_score?: number;
  persona_assignment_method?: string;
  sms_opt_in: boolean;
  created_at: string;
  order_history: any[];
}

interface PersonaData {
  id: string;
  name: string;
  tone: string;
  description: string;
  buying_triggers: string[];
  sample_phrases: string[];
  ideal_products: string[];
  icon: string;
  color_theme: string;
}

const CustomerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadCustomer();
    }
  }, [user, id]);

  const loadCustomer = async () => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (userData?.tenant_id) {
        const { data, error } = await supabase
          .from('crm_customers')
          .select(`
            *,
            personas:persona_id (
              id, name, tone, description, buying_triggers, 
              sample_phrases, icon, color_theme
            )
          `)
          .eq('tenant_id', userData.tenant_id)
          .eq('id', id)
          .single();

        if (error) throw error;
        
        setCustomer(data as Customer);
        if (data.personas) {
          setPersonaData(data.personas as PersonaData);
        }
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast({
        title: "Error",
        description: "Failed to load customer profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaAssign = async (persona: any) => {
    try {
      const { error } = await supabase
        .from('crm_customers')
        .update({ 
          persona_id: persona.id,
          persona: persona.name 
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Persona Assigned",
        description: `Persona Assigned: ${persona.name} ${persona.icon}`,
      });

      // Reload customer data
      await loadCustomer();
      setIsPersonaModalOpen(false);
    } catch (error) {
      console.error('Error assigning persona:', error);
      toast({
        title: "Error",
        description: "Failed to assign persona",
        variant: "destructive"
      });
    }
  };

  const handleAutoAssignPersona = async () => {
    if (!customer || !user) return;

    setAutoAssigning(true);
    try {
      // Get tenant_id from users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const { data, error } = await supabase.functions.invoke('persona-auto-assignment', {
        body: {
          customer_id: customer.id,
          order_history: customer.order_history || [],
          tenant_id: userData?.tenant_id
        }
      });

      if (error) {
        console.error('Error auto-assigning persona:', error);
        toast({
          title: "Error",
          description: "Failed to auto-assign persona",
          variant: "destructive",
        });
        return;
      }

      if (data.success && data.persona) {
        toast({
          title: "Persona Assigned",
          description: `Auto-assigned: ${data.persona.name} 🌿`,
        });
        // Reload customer data to show the new persona
        loadCustomer();
      } else {
        toast({
          title: "No Match Found",
          description: "No suitable persona match found based on purchase history",
        });
      }
    } catch (error) {
      console.error('Error auto-assigning persona:', error);
      toast({
        title: "Error",
        description: "Failed to auto-assign persona",
        variant: "destructive",
      });
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleCreateSegmentFromPersona = () => {
    if (personaData) {
      navigate(`/crm/segments?persona=${personaData.id}&name=${encodeURIComponent(personaData.name)}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Customer not found</h3>
          <Button onClick={() => navigate('/crm')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to CRM
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SubscriptionGate requiredPlan="bloom" feature="Customer Profiles">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {customer.first_name} {customer.last_name}
              </h1>
              <p className="text-muted-foreground">{customer.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsPersonaModalOpen(true)}>
              <Target className="h-4 w-4 mr-2" />
              {personaData ? 'Change Persona' : 'Assign Persona'}
            </Button>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Persona Summary */}
            {personaData ? (
              <PersonaSummaryCard 
                persona={personaData}
                onAssignClick={() => setIsPersonaModalOpen(true)}
                confidenceScore={customer?.persona_confidence_score}
                assignmentMethod={customer?.persona_assignment_method}
              />
            ) : (
              <PersonaSummaryCard 
                onAssignClick={() => setIsPersonaModalOpen(true)}
              />
            )}

            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Email:</span>
                      <span>{customer.email}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>
                        <span>{customer.phone}</span>
                        {customer.sms_opt_in && (
                          <Badge variant="outline" className="text-xs">SMS OK</Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Customer Since:</span>
                      <span>{format(new Date(customer.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Total Spent:</span>
                      <span className="font-bold">${customer.total_spent?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Orders:</span>
                      <span>{customer.order_history?.length || 0}</span>
                    </div>
                    {customer.last_purchase_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Last Purchase:</span>
                        <span>{format(new Date(customer.last_purchase_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {customer.tags && customer.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Tags:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {customer.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Order History */}
            {customer.order_history && customer.order_history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {customer.order_history.slice(0, 5).map((order: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">Order #{order.id}</div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(order.date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">${order.total}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.items?.length || 0} items
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full">
                  <Link to={`/crm/campaigns/new?segment_customer=${customer.id}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Link>
                </Button>
                <Button variant="outline" className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Follow-up
                </Button>
                <Button 
                  onClick={handleAutoAssignPersona}
                  className="w-full"
                  variant="secondary"
                  disabled={autoAssigning}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {autoAssigning ? 'Auto-Assigning...' : 'Auto-Assign Persona'}
                </Button>
                <Button variant="outline" className="w-full">
                  <Tag className="h-4 w-4 mr-2" />
                  Add Tags
                </Button>
              </CardContent>
            </Card>

            {/* Suggested Actions */}
            {personaData && (
              <Card>
                <CardHeader>
                  <CardTitle>Persona Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Suggested Segment:
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCreateSegmentFromPersona}
                      className="w-full"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Create Segment from Persona
                    </Button>
                  </div>
                  
                  {personaData.buying_triggers && personaData.buying_triggers.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">
                        Buying Triggers:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {personaData.buying_triggers.slice(0, 3).map((trigger, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Persona Assignment Modal */}
        <PersonaModal
          isOpen={isPersonaModalOpen}
          onClose={() => setIsPersonaModalOpen(false)}
          mode="assign"
          onPersonaSelect={handlePersonaAssign}
        />
      </div>
    </SubscriptionGate>
  );
};

export default CustomerProfile;