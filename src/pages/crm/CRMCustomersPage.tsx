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
import { useCustomers } from '@/hooks/useCustomers';
import { format } from 'date-fns';

export const CRMCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: customers = [], isLoading, invalidateCustomers } = useCustomers({ 
    search: searchQuery 
  });

  const personaColors: Record<string, string> = {
    newbie: 'bg-blue-100 text-blue-800',
    struggler: 'bg-yellow-100 text-yellow-800',
    regular: 'bg-green-100 text-green-800',
    expert: 'bg-purple-100 text-purple-800',
  };

  const handleImportComplete = () => {
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
                        onClick={() => navigate(`/crm/customers/${customer.id}`)}
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
                          {customer.persona ? (
                            <Badge 
                              variant="secondary" 
                              className={personaColors[customer.persona] || 'bg-gray-100 text-gray-800'}
                            >
                              {customer.persona}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No persona</span>
                          )}
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
    </div>
  );
};