import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Users, UserPlus, Search } from "lucide-react";
import { useCRMCustomers } from "@/hooks/useCRMCustomers";
import { useCustomerPersonas } from "@/hooks/useCustomerPersonas";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo } from "react";

interface PersonaDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: any;
  onAssignmentChange?: () => void;
}

// Helper component to handle individual customer persona management
const CustomerPersonaManager: React.FC<{
  customerId: string;
  persona: any;
  onAssignmentChange: () => void;
  children: (isAssigned: boolean, assign: () => Promise<void>, unassign: () => Promise<void>, isLoading: boolean, isActionLoading: boolean) => React.ReactNode;
}> = ({ customerId, persona, onAssignmentChange, children }) => {
  const { assignedPersonaIds, assignPersona, unassignPersona, isLoading } = useCustomerPersonas(customerId);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  const isAssigned = useMemo(() => {
    return assignedPersonaIds.includes(persona.id);
  }, [assignedPersonaIds, persona.id]);

  const handleAssign = async () => {
    setIsActionLoading(true);
    const success = await assignPersona(persona.id, persona.is_custom);
    if (success) {
      console.log('✅ Customer assigned to persona successfully');
      onAssignmentChange();
    } else {
      console.error('❌ Failed to assign customer to persona');
    }
    setIsActionLoading(false);
  };

  const handleUnassign = async () => {
    setIsActionLoading(true);
    const success = await unassignPersona(persona.id, persona.is_custom);
    if (success) {
      console.log('✅ Customer removed from persona successfully');
      onAssignmentChange();
    } else {
      console.error('❌ Failed to remove customer from persona');
    }
    setIsActionLoading(false);
  };

  return <>{children(isAssigned, handleAssign, handleUnassign, isLoading, isActionLoading)}</>;
};

export const PersonaDetailsDialog: React.FC<PersonaDetailsDialogProps> = ({
  open,
  onOpenChange,
  persona,
  onAssignmentChange,
}) => {
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { customers, loading: customersLoading } = useCRMCustomers();
  const isMobile = useIsMobile();

  const handleAssignmentChange = () => {
    setRefreshKey(prev => prev + 1);
    onAssignmentChange?.();
  };

  if (!persona) {
    console.log('🔍 PersonaDetailsDialog: No persona provided');
    return null;
  }

  // Filter customers based on search term
  const getFilteredCustomers = () => {
    if (!customerSearchTerm) return customers;
    
    return customers.filter(customer => 
      customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      (customer.first_name?.toLowerCase().includes(customerSearchTerm.toLowerCase())) ||
      (customer.last_name?.toLowerCase().includes(customerSearchTerm.toLowerCase()))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-white border shadow-lg p-6">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
        </Button>

        <div key={refreshKey} className="space-y-6 pb-16 px-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-semibold mb-2">
              {persona.persona_name}
            </h2>
            {persona.persona_description && (
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {persona.persona_description}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Type</h4>
              <Badge variant={persona.is_custom ? "default" : "secondary"} className="text-sm">
                {persona.is_custom ? "Custom" : "Predefined"}
              </Badge>
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
              <div className="space-y-4">
                {/* Customer List */}
                <ScrollArea className="h-64 border rounded-md p-4">
                  <div className="space-y-2">
                    {getFilteredCustomers().map((customer) => (
                      <CustomerPersonaManager
                        key={customer.id}
                        customerId={customer.id}
                        persona={persona}
                        onAssignmentChange={handleAssignmentChange}
                      >
                        {(isAssigned, assign, unassign, isLoading, isActionLoading) => (
                          <div className={`flex items-center justify-between p-3 rounded-md border ${
                            isAssigned ? 'bg-green-50 border-green-200' : 'bg-background'
                          }`}>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {customer.first_name} {customer.last_name}
                                </p>
                                {!isLoading && isAssigned && (
                                  <Badge variant="secondary" className="text-xs">
                                    Assigned
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{customer.email}</p>
                            </div>
                            {!isLoading && (
                              <Button
                                variant={isAssigned ? "destructive" : "default"}
                                size="sm"
                                onClick={isAssigned ? unassign : assign}
                                className="h-8 w-8 p-0 flex-shrink-0"
                                title={isAssigned ? "Remove from persona" : "Assign to persona"}
                                disabled={isActionLoading}
                              >
                                {isActionLoading ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                                ) : (
                                  !isLoading && (isAssigned ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </CustomerPersonaManager>
                    ))}
                    {getFilteredCustomers().length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {customerSearchTerm ? 'No customers found matching your search' : 'No customers available'}
                      </p>
                    )}
                  </div>
                </ScrollArea>
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