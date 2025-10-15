import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CustomerPersonaSelector } from '@/components/crm/CustomerPersonaSelector';
import { CustomerSegmentSelector } from '@/components/crm/CustomerSegmentSelector';
import { Mail, Phone, Calendar, DollarSign, Save, User, ArrowLeft, Edit } from 'lucide-react';
import { format } from 'date-fns';

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string;
  persona_id?: string;
  tags?: string[];
  total_spent?: number;
  last_purchase_date?: string;
  sms_opt_in?: boolean;
  created_at: string;
  updated_at: string;
}

export const CustomerDetailPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (customerId) {
      fetchCustomer();
    }
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      setIsLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: userRecord } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userRecord?.tenant_id) throw new Error('No tenant found');

      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('id', customerId)
        .eq('tenant_id', userRecord.tenant_id)
        .single();

      if (error) throw error;
      
      if (data) {
        setCustomer(data);
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          phone: data.phone || ''
        });
        setPersonaId(data.persona_id || null);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast({
        title: 'Error loading customer',
        description: 'Could not load customer details.',
        variant: 'destructive',
      });
      navigate('/crm/customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customer) return;
    
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('crm_customers')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          email: formData.email,
          phone: formData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (error) throw error;

      toast({
        title: 'Customer updated',
        description: 'Customer details have been successfully updated.',
      });

      setIsEditing(false);
      await fetchCustomer();
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: 'Error updating customer',
        description: 'There was a problem updating the customer details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePersonaUpdate = (personaIds: string[]) => {
    setPersonaId(personaIds[0] || null);
    fetchCustomer();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Customer not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/crm/customers')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-8 w-8" />
            {customer.first_name || customer.last_name 
              ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
              : customer.email
            }
          </h1>
          <p className="text-muted-foreground">Customer Details</p>
        </div>
      </div>

      {/* Customer Stats - At the Top */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-xl">Customer Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Total Spent</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">
                  ${customer.total_spent?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Last Purchase</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">
                  {customer.last_purchase_date 
                    ? format(new Date(customer.last_purchase_date), 'MMM d, yyyy')
                    : 'No purchases'
                  }
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium text-muted-foreground">Customer Since</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">
                  {format(new Date(customer.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
          {customer.sms_opt_in && (
            <div className="mt-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                SMS Opt-in
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Customer Information
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      first_name: customer.first_name || '',
                      last_name: customer.last_name || '',
                      email: customer.email || '',
                      phone: customer.phone || ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                <div className="font-medium text-lg">
                  {customer.first_name || customer.last_name 
                    ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                    : 'No name provided'
                  }
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg">{customer.email}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg">{customer.phone || 'No phone number'}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Persona Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Persona</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerPersonaSelector 
            value={personaId} 
            onChange={handlePersonaUpdate}
            customerId={customer.id}
          />
        </CardContent>
      </Card>

      {/* Segments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Segments</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerSegmentSelector customerId={customer.id} />
        </CardContent>
      </Card>
    </div>
  );
};
