import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Phone, Mail } from 'lucide-react';
import { useAllPersonas } from '@/hooks/useAllPersonas';

interface CRMCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string; // Legacy field
  persona_id?: string; // New unified persona reference
}

interface RecipientsPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CRMCustomer[];
}

export const RecipientsPreview: React.FC<RecipientsPreviewProps> = ({
  isOpen,
  onClose,
  customers
}) => {
  const { personas } = useAllPersonas();
  
  const getCustomerName = (customer: CRMCustomer) => {
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    return customer.email.split('@')[0];
  };

  // Get persona name for a customer using unified approach
  const getCustomerPersonaName = (customer: CRMCustomer) => {
    if (customer.persona_id && personas) {
      const persona = personas.find(p => p.id === customer.persona_id);
      return persona?.persona_name;
    }
    // Fallback to legacy persona field if persona_id not available
    return customer.persona;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Campaign Recipients ({customers.length})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recipients found for the current targeting criteria.</p>
              <p className="text-sm mt-2">Try adjusting your audience selection or ensure customers have opted in to SMS.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{getCustomerName(customer)}</h4>
                      {getCustomerPersonaName(customer) && (
                        <Badge variant="secondary" className="text-xs">
                          {getCustomerPersonaName(customer)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{customer.email}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};