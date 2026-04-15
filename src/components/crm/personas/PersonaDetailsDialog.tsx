import React, { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Input } from "@/components/ui-legacy/input";
import { X, Users, UserPlus, Search, Loader2 } from "lucide-react";
import { usePaginatedCustomers } from "@/hooks/usePaginatedCustomers";
import { LazyCustomerList } from "@/components/shared/LazyCustomerList";
import { useCustomerPersonas } from "@/hooks/useCustomerPersonas";
import { useIsMobile } from "@/hooks/use-mobile";

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
      onAssignmentChange();
    }
    setIsActionLoading(false);
  };

  const handleUnassign = async () => {
    setIsActionLoading(true);
    const success = await unassignPersona(persona.id, persona.is_custom);
    if (success) {
      onAssignmentChange();
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
  const isMobile = useIsMobile();

  // Use lazy loaded customers
  const {
    customers,
    isLoading: customersLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalCount,
    isSearching,
  } = usePaginatedCustomers({
    searchTerm: customerSearchTerm,
    pageSize: 25,
    enabled: open && !!persona,
  });

  const handleAssignmentChange = () => {
    setRefreshKey(prev => prev + 1);
    onAssignmentChange?.();
  };

  // Reset search when dialog closes
  React.useEffect(() => {
    if (!open) {
      setCustomerSearchTerm('');
    }
  }, [open]);

  if (!persona) {
    return null;
  }

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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Customer List with Lazy Loading */}
            <LazyCustomerList
              customers={customers}
              isLoading={customersLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              onLoadMore={() => fetchNextPage()}
              totalCount={totalCount}
              emptyMessage="No customers available"
              searchTerm={customerSearchTerm}
              isSearching={isSearching}
              height="h-64"
              renderCustomer={(customer) => (
                <CustomerPersonaManager
                  customerId={customer.id}
                  persona={persona}
                  onAssignmentChange={handleAssignmentChange}
                >
                  {(isAssigned, assign, unassign, isLoading, isActionLoading) => (
                    <div className={`flex items-center justify-between p-3 rounded-md border mb-2 ${
                      isAssigned ? 'bg-green-50 border-green-200' : 'bg-background'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {customer.first_name} {customer.last_name}
                          </p>
                          {!isLoading && isAssigned && (
                            <Badge variant="secondary" className="text-xs">
                              Assigned
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                      </div>
                      {!isLoading && (
                        <Button
                          variant={isAssigned ? "destructive" : "default"}
                          size="sm"
                          onClick={isAssigned ? unassign : assign}
                          className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                          title={isAssigned ? "Remove from persona" : "Assign to persona"}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            isAssigned ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </CustomerPersonaManager>
              )}
            />
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
