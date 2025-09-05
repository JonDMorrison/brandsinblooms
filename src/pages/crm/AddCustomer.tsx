import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Plus, 
  X, 
  Save, 
  User, 
  Mail, 
  Phone, 
  DollarSign,
  Calendar,
  MessageSquare,
  Tag
} from 'lucide-react';

type CustomerFormData = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  persona: string;
  tags: string[];
  sms_opt_in: boolean;
  lifetime_value: number;
  last_purchase_date: string;
  custom_fields: Record<string, any>;
  notes: string;
};

const AddCustomer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  
  const [formData, setFormData] = useState<CustomerFormData>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    persona: '',
    tags: [],
    sms_opt_in: false,
    lifetime_value: 0,
    last_purchase_date: '',
    custom_fields: {},
    notes: ''
  });

  const [newTag, setNewTag] = useState('');

  const customerPersonas = [
    { value: 'newbie', label: 'Newbie Gardener' },
    { value: 'struggler', label: 'Struggling Gardener' }, 
    { value: 'regular', label: 'Regular Gardener' },
    { value: 'expert', label: 'Expert Gardener' }
  ];

  const addCustomerMutation = useMutation({
    mutationFn: async (customerData: CustomerFormData) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      if (!tenant?.id) {
        throw new Error('You are not assigned to a tenant. Please contact support or create an organization to continue.');
      }

      const dataToInsert = {
        email: customerData.email,
        first_name: customerData.first_name || null,
        last_name: customerData.last_name || null,
        phone: customerData.phone || null,
        persona: customerData.persona || null,
        tags: customerData.tags.length > 0 ? customerData.tags : null,
        sms_opt_in: customerData.sms_opt_in,
        sms_opt_in_at: customerData.sms_opt_in ? new Date().toISOString() : null,
        last_purchase_date: customerData.last_purchase_date || null,
        lifetime_value: customerData.lifetime_value || null,
        custom_fields: {
          ...customerData.custom_fields,
          notes: customerData.notes
        },
        user_id: user.id,
        tenant_id: tenant.id
      };
      
      const { data, error } = await supabase
        .from('crm_customers')
        .insert([dataToInsert])
        .select()
        .single();
      
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      toast({ 
        title: "Customer added successfully",
        description: "The new customer has been added to your database."
      });
      navigate('/crm/customers');
    },
    onError: (error: any) => {
      console.error('Error adding customer:', error);
      
      // Handle persona constraint errors specifically
      if (error.message.includes('persona_check') || error.message.includes('persona')) {
        toast({ 
          title: "Invalid Persona", 
          description: "Please select a valid persona (Newbie, Struggler, Regular, or Expert)", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error adding customer", 
          description: error.message, 
          variant: "destructive" 
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    addCustomerMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof CustomerFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Show loading state while checking tenant
  if (tenantLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading organization information...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if tenant is missing
  if (tenantError) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Add New Customer</h1>
          <p className="text-muted-foreground">
            Add a new customer to your garden center database
          </p>
        </div>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-destructive mb-2">Organization Required</h3>
          <p className="text-muted-foreground mb-4">{tenantError}</p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/crm/customers')}
            >
              Go Back
            </Button>
            <Button
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => {
          console.log('Back to Customers button clicked, attempting navigation...');
          navigate('/crm/customers');
        }}
        className="flex items-center gap-2 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Button>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Add New Customer</h1>
        <p className="text-muted-foreground">
          Add a new customer to your garden center database
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="customer@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="persona">Gardening Persona</Label>
                <NativeSelect 
                  value={formData.persona} 
                  onChange={(e) => handleInputChange('persona', e.target.value)}
                  placeholder="Select a persona..."
                  options={customerPersonas}
                />
              </div>

              <div>
                <Label htmlFor="lifetime_value">Lifetime Value</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="lifetime_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.lifetime_value}
                    onChange={(e) => handleInputChange('lifetime_value', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="last_purchase_date">Last Purchase Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="last_purchase_date"
                    type="date"
                    value={formData.last_purchase_date}
                    onChange={(e) => handleInputChange('last_purchase_date', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags & Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tags & Interests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tags">Customer Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="tags"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="sms_opt_in"
                  checked={formData.sms_opt_in}
                  onCheckedChange={(checked) => handleInputChange('sms_opt_in', checked)}
                />
                <Label htmlFor="sms_opt_in" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS Marketing Opt-in
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="notes">Customer Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Add any additional notes about this customer..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              console.log('Cancel button clicked, attempting navigation...');
              navigate('/crm/customers');
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={addCustomerMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {addCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddCustomer;