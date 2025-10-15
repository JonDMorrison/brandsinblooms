import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Plus, Search, Mail, Phone, Calendar, DollarSign, Upload } from 'lucide-react';
import { EnhancedSegmentImportDialog } from '@/components/crm/segments/EnhancedSegmentImportDialog';
import { useCustomers } from '@/hooks/useCustomers';
import { useAllPersonas } from '@/hooks/useAllPersonas';
import { useAllSegments } from '@/hooks/useAllSegments';
import { format } from 'date-fns';

export const CRMCustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const { data: customers = [], isLoading, invalidateCustomers } = useCustomers({
    search: searchQuery 
  });
  const { personas } = useAllPersonas();
  const { segments: allSegments } = useAllSegments();

  // Get persona details for a customer using unified approach
  const getCustomerPersona = (customer: any) => {
    // First check the new junction table for persona assignments
    if (customer.customer_personas && customer.customer_personas.length > 0) {
      const assignment = customer.customer_personas[0]; // Get first persona assignment
      
      // Check if it's a predefined persona
      if (assignment.predefined_persona_id && personas) {
        return personas.find(p => p.id === assignment.predefined_persona_id);
      }
      
      // Check if it's a custom persona
      if (assignment.persona_id && personas) {
        return personas.find(p => p.id === assignment.persona_id);
      }
    }
    
    // Fallback to legacy persona_id field
    if (customer.persona_id && personas) {
      return personas.find(p => p.id === customer.persona_id);
    }
    
    return null;
  };

  // Get all assigned persona names for display (in case multiple are assigned)
  const getCustomerPersonas = (customer: any) => {
    if (!customer.customer_personas || customer.customer_personas.length === 0) {
      return [];
    }
    
    const personaNames = [];
    for (const assignment of customer.customer_personas) {
      let persona = null;
      
      if (assignment.predefined_persona_id && personas) {
        persona = personas.find(p => p.id === assignment.predefined_persona_id);
      } else if (assignment.persona_id && personas) {
        persona = personas.find(p => p.id === assignment.persona_id);
      }
      
      if (persona) {
        personaNames.push(persona.persona_name);
      }
    }
    
    return personaNames;
  };

  // Get all assigned segment names for display
  const getCustomerSegments = (customer: any) => {
    if (!customer.customer_segments || customer.customer_segments.length === 0) {
      return [];
    }
    
    const segmentNames = [];
    for (const assignment of customer.customer_segments) {
      // Look up segment name from allSegments by matching segment_id
      const segment = allSegments.find(s => s.id === assignment.segment_id);
      if (segment?.name) {
        segmentNames.push(segment.name);
      }
    }
    
    return segmentNames;
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

  // Dynamic segment colors for visual variety
  const getSegmentColor = (segmentName: string) => {
    const colorMap: Record<string, string> = {
      'Loyalty Members': 'bg-blue-100 text-blue-800',
      'High-Value Customers': 'bg-emerald-100 text-emerald-800',
      'New Customers': 'bg-sky-100 text-sky-800',
      'Lapsed Customers': 'bg-orange-100 text-orange-800',
      'Seasonal Shoppers': 'bg-violet-100 text-violet-800',
      'Frequent Buyers': 'bg-rose-100 text-rose-800',
    };
    return colorMap[segmentName] || 'bg-slate-100 text-slate-800';
  };

  const handleImportComplete = () => {
    invalidateCustomers();
  };

  const handleCustomerClick = (customer: any) => {
    navigate(`/crm/customers/${customer.id}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Customers</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Customers
            </Button>
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
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Customers
          </Button>
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
              <div className="rounded-md border overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[800px]">
                    <Table data-testid="customers-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead className="hidden md:table-cell">Contact</TableHead>
                          <TableHead>Persona</TableHead>
                          <TableHead className="hidden lg:table-cell">Segments</TableHead>
                          <TableHead className="hidden sm:table-cell">Total Spent</TableHead>
                          <TableHead className="hidden xl:table-cell">Last Purchase</TableHead>
                          <TableHead className="hidden lg:table-cell">Added</TableHead>
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
                            <TableCell className="hidden md:table-cell">
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
                                 const assignedPersonas = getCustomerPersonas(customer);
                                 return assignedPersonas.length > 0 ? (
                                   <div className="flex flex-wrap gap-1">
                                     {assignedPersonas.map((personaName, index) => (
                                       <Badge 
                                         key={index}
                                         variant="secondary" 
                                         className={getPersonaColor(personaName)}
                                       >
                                         {personaName}
                                       </Badge>
                                     ))}
                                   </div>
                                 ) : (
                                   <span className="text-muted-foreground text-sm whitespace-nowrap">No persona</span>
                                 );
                               })()}
                             </TableCell>
                             <TableCell className="hidden lg:table-cell">
                               {(() => {
                                 const assignedSegments = getCustomerSegments(customer);
                                 return assignedSegments.length > 0 ? (
                                   <div className="flex flex-wrap gap-1">
                                     {assignedSegments.map((segmentName, index) => (
                                       <Badge 
                                         key={index}
                                         variant="secondary" 
                                         className={getSegmentColor(segmentName)}
                                       >
                                         {segmentName}
                                       </Badge>
                                     ))}
                                   </div>
                                 ) : (
                                   <span className="text-muted-foreground text-sm whitespace-nowrap">No segments</span>
                                 );
                               })()}
                             </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {customer.total_spent ? (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  ${customer.total_spent.toFixed(2)}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">$0.00</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden xl:table-cell whitespace-nowrap">
                              {customer.last_purchase_date ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(customer.last_purchase_date), 'MMM d, yyyy')}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No purchases</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell whitespace-nowrap">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(customer.created_at), 'MMM d, yyyy')}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EnhancedSegmentImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};