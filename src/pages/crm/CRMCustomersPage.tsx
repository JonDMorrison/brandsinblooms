import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Plus, Search, Mail, Phone, Calendar, DollarSign } from 'lucide-react';
import { CustomerImportDialog } from '@/components/crm/customers/CustomerImportDialog';
import { CustomerDetailsSheet } from '@/components/crm/customers/CustomerDetailsSheet';
import { useCustomers } from '@/hooks/useCustomers';
import { useAllPersonas } from '@/hooks/useAllPersonas';
import { format } from 'date-fns';

export const CRMCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const { data: customers = [], isLoading, invalidateCustomers } = useCustomers({ 
    search: searchQuery 
  });
  const { personas } = useAllPersonas();

  // Get persona details for a customer using unified approach
  const getCustomerPersona = (customer: any) => {
    if (customer.persona_id && personas) {
      return personas.find(p => p.id === customer.persona_id);
    }
    return null;
  };

  // Dynamic persona colors based on the actual personas
  const getPersonaColor = (personaName: string) => {
    const colorMap: Record<string, string> = {
      'Plant-Killer Pam': 'bg-green-100 text-green-800',
      'Pet-Friendly Hannah': 'bg-purple-100 text-purple-800',
      'Vegetable Garden Veronica': 'bg-amber-100 text-amber-800',
      'Sustainable Susie': 'bg-teal-100 text-teal-800',
      'Patio Gardener Gail': 'bg-red-100 text-red-800',
      'Pollinator Paula': 'bg-orange-100 text-orange-800',
      'Curb Appeal Ashley': 'bg-pink-100 text-pink-800',
      'DIY Dana': 'bg-indigo-100 text-indigo-800',
      'Wellness Whitney': 'bg-cyan-100 text-cyan-800',
    };
    return colorMap[personaName] || 'bg-gray-100 text-gray-800';
  };

  const handleImportComplete = () => {
    invalidateCustomers();
  };

  const handleCustomerClick = (customer: any) => {
    setSelectedCustomer(customer);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedCustomer(null);
  };

  const handleCustomerUpdated = () => {
    invalidateCustomers();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Customers</h1>
          <div className="flex gap-2">
            <CustomerImportDialog onImportComplete={handleImportComplete} />
            <Button onClick={() => navigate('/crm/customers/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <CustomerImportDialog onImportComplete={handleImportComplete} />
          <Button onClick={() => navigate('/crm/customers/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Management ({customers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <Input 
                placeholder="Search customers by name or email..." 
                className="max-w-sm" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers found"
                description={searchQuery ? 
                  "No customers match your search criteria. Try adjusting your search or add a new customer." :
                  "Start building your customer base by adding your first customer or importing a customer list."
                }
                action={{
                  label: "Add Customer",
                  onClick: () => navigate('/crm/customers/new')
                }}
              />
            ) : (
              <div className="rounded-md border">
                <Table data-testid="customers-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Last Purchase</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                       <TableRow 
                         key={customer.id}
                         className="cursor-pointer hover:bg-muted/50"
                         onClick={() => handleCustomerClick(customer)}
                       >
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {customer.first_name || customer.last_name 
                                ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                                : 'No name'
                              }
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No phone</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const persona = getCustomerPersona(customer);
                            return persona ? (
                              <Badge 
                                variant="secondary" 
                                className={getPersonaColor(persona.persona_name)}
                              >
                                {persona.persona_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm whitespace-nowrap">No persona</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {customer.total_spent ? (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${customer.total_spent.toFixed(2)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">$0.00</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.last_purchase_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(customer.last_purchase_date), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No purchases</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(customer.created_at), 'MMM d, yyyy')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CustomerDetailsSheet 
        customer={selectedCustomer}
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        onCustomerUpdated={handleCustomerUpdated}
      />
    </div>
  );
};