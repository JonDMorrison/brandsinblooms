import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Target, Search, Users, UserPlus, X } from 'lucide-react';
import { useCRMCustomers } from '@/hooks/useCRMCustomers';
import { useCustomerPersonas } from '@/hooks/useCustomerPersonas';
import { useIsMobile } from '@/hooks/use-mobile';

interface PersonaDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
    created_at: string;
  } | null;
}

export const PersonaDetailsDialog: React.FC<PersonaDetailsDialogProps> = ({
  open,
  onOpenChange,
  persona,
}) => {
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const { customers, loading: customersLoading, assignPersonaToCustomer, removePersonaFromCustomer } = useCRMCustomers();
  const isMobile = useIsMobile();

  // Remove customer from persona
  const removeCustomerFromPersona = async (customerId: string) => {
    const success = await removePersonaFromCustomer(customerId);
    if (success) {
      console.log('✅ Customer removed from persona successfully');
      // The hook will automatically update the state, so customers will move between lists
    } else {
      console.error('❌ Failed to remove customer from persona');
    }
  };

  if (!persona) {
    console.log('🔍 PersonaDetailsDialog: No persona provided');
    return null;
  }

  // Get customers assigned to this persona
  const getPersonaCustomers = () => {
    return customers.filter(customer => 
      customer.persona === persona.persona_name
    );
  };

  // Get unassigned customers
  const getUnassignedCustomers = () => {
    return customers.filter(customer => 
      !customer.persona || customer.persona !== persona.persona_name
    );
  };

  // Filter customers based on search term
  const getFilteredPersonaCustomers = () => {
    const personaCustomers = getPersonaCustomers();
    console.log('🔧 PersonaDetailsDialog - All customers:', customers.length);
    console.log('🔧 PersonaDetailsDialog - Persona customers:', personaCustomers.length, 'for persona:', persona.persona_name);
    console.log('🔧 PersonaDetailsDialog - Sample customers:', customers.slice(0, 3).map(c => ({ id: c.id, email: c.email, persona: c.persona })));
    
    if (!customerSearchTerm) return personaCustomers;
    
    return personaCustomers.filter(customer => 
      customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      (customer.first_name?.toLowerCase().includes(customerSearchTerm.toLowerCase())) ||
      (customer.last_name?.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    );
  };

  const getFilteredUnassignedCustomers = () => {
    const unassigned = getUnassignedCustomers();
    if (!customerSearchTerm) return unassigned.slice(0, 10);
    
    return unassigned.filter(customer => 
      customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      (customer.first_name?.toLowerCase().includes(customerSearchTerm.toLowerCase())) ||
      (customer.last_name?.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    ).slice(0, 10);
  };

  const handleAssignCustomer = async (customerId: string) => {
    await assignPersonaToCustomer(customerId, persona.persona_name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-white border shadow-lg p-6">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 h-6 w-6 rounded-full z-50"
        >
          <X className="h-4 w-4" />
        </Button>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Target className="h-5 w-5" />
            {persona.persona_name}
            <Badge variant={persona.is_custom ? "default" : "secondary"} className="ml-2">
              {persona.is_custom ? "Custom" : "System"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-16 px-6">
          {/* Basic Info */}
          <div className="space-y-4">
            {persona.persona_description && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Description</h4>
                <p className="text-sm">{persona.persona_description}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Customer Count</h4>
              <p className="text-sm">{getPersonaCustomers().length} assigned customers</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Created</h4>
              <p className="text-sm">{new Date(persona.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Customer Management */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h4 className="font-semibold">Customer Management</h4>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {customersLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Assigned Customers */}
                <div>
                  <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                    Assigned Customers
                    <Badge variant="secondary" className="text-xs">
                      {getFilteredPersonaCustomers().length}
                    </Badge>
                  </h5>
                  <ScrollArea className="h-48 border rounded-md p-2">
                     <div className="space-y-2">
                       {getFilteredPersonaCustomers().length > 0 ? (
                         getFilteredPersonaCustomers().map((customer) => (
                           <div key={customer.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                             <div className="flex-1">
                               <p className="font-medium">
                                 {customer.first_name} {customer.last_name}
                               </p>
                               <p className="text-xs text-muted-foreground">{customer.email}</p>
                             </div>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => {
                                 console.log('🔧 Removing customer from persona:', customer.id);
                                 removeCustomerFromPersona(customer.id);
                               }}
                               className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-2 flex-shrink-0"
                               title="Remove from persona"
                             >
                               <X className="h-4 w-4" />
                             </Button>
                           </div>
                         ))
                       ) : (
                         <p className="text-xs text-muted-foreground text-center py-4">
                           No customers assigned to this persona
                         </p>
                       )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Available to Assign */}
                <div>
                  <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                    Available to Assign
                    <Badge variant="outline" className="text-xs">
                      {getFilteredUnassignedCustomers().length}
                    </Badge>
                  </h5>
                  <ScrollArea className="h-48 border rounded-md p-2">
                    <div className="space-y-2">
                      {getFilteredUnassignedCustomers().map((customer) => (
                        <div key={customer.id} className="flex items-center justify-between p-2 bg-background border rounded text-sm">
                          <div>
                            <p className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAssignCustomer(customer.id)}
                            className="h-7 w-7 p-0"
                            title="Assign to persona"
                          >
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {getFilteredUnassignedCustomers().length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No unassigned customers found
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save & Close Button */}
        <div className="absolute bottom-4 right-4">
          <Button onClick={() => onOpenChange(false)}>
            Save & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};