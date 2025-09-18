import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CustomerPersonaSelector } from '@/components/crm/CustomerPersonaSelector';
import { CustomerSegmentSelector } from '@/components/crm/CustomerSegmentSelector';
import { Mail, Phone, Calendar, DollarSign, Save, User } from 'lucide-react';
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

interface CustomerDetailsSheetProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onCustomerUpdated: () => void;
}

export const CustomerDetailsSheet: React.FC<CustomerDetailsSheetProps> = ({
  customer,
  isOpen,
  onClose,
  onCustomerUpdated
}) => {
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

  React.useEffect(() => {
    if (customer) {
      setFormData({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || ''
      });
      setPersonaId(customer.persona_id || null);
    }
  }, [customer]);

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
      onCustomerUpdated();
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
    // For now, just use the first persona ID for backward compatibility
    setPersonaId(personaIds[0] || null);
    onCustomerUpdated();
  };

  const handleSaveAndClose = async () => {
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
      onCustomerUpdated();
      onClose(); // Close the modal after saving
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

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Customer Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Customer Information
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
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
                    <div className="font-medium">
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
                      <span>{customer.email}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.phone || 'No phone number'}</span>
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

          <Separator />

          {/* Customer Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Total Spent</Label>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      ${customer.total_spent?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Purchase</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {customer.last_purchase_date 
                        ? format(new Date(customer.last_purchase_date), 'MMM d, yyyy')
                        : 'No purchases'
                      }
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Customer Since</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(customer.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              {customer.sms_opt_in && (
                <div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    SMS Opt-in
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer with Save & Close button */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-muted-foreground">
              {isEditing && "Don't forget to save your changes"}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="transition-all duration-200">
                Cancel
              </Button>
              <Button 
                onClick={handleSaveAndClose}
                disabled={isSaving}
                className="transition-all duration-200"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save & Close'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};