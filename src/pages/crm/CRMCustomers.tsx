import React, { useState, useEffect } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Upload, 
  Filter,
  Users,
  Phone,
  Mail,
  Calendar,
  MoreHorizontal,
  Edit,
  X
} from 'lucide-react';
import { CustomerImportModal } from '@/components/crm/CustomerImportModal';

type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  persona: string | null;
  tags: string[] | null;
  last_purchase_date: string | null;
  lifetime_value: number | null;
  sms_opt_in: boolean | null;
  sms_opt_in_at: string | null;
  custom_fields: any;
  created_at: string;
  updated_at: string;
};

const CRMCustomers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [personaFilter, setPersonaFilter] = useState<string>('all');
  const [smsOptInFilter, setSmsOptInFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const customerPersonas = [
    { name: 'Newbie', count: 0, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    { name: 'Struggler', count: 0, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
    { name: 'Regular', count: 0, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { name: 'Expert', count: 0, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  ];

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['crm-customers', searchTerm, personaFilter, smsOptInFilter, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('crm_customers')
        .select('*')
        .order(sortBy, { ascending: sortBy === 'first_name' });

      if (searchTerm) {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      if (personaFilter !== 'all') {
        query = query.eq('persona', personaFilter);
      }

      if (smsOptInFilter !== 'all') {
        query = query.eq('sms_opt_in', smsOptInFilter === 'true');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    }
  });

  // Get unique tags for filter
  const { data: allTags = [] } = useQuery({
    queryKey: ['crm-customer-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_customers')
        .select('tags');
      
      if (error) throw error;
      
      const tagSet = new Set<string>();
      data?.forEach(customer => {
        customer.tags?.forEach((tag: string) => tagSet.add(tag));
      });
      
      return Array.from(tagSet);
    }
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_customers')
        .update(updates)
        .eq('id', updates.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
      toast({ title: "Customer updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating customer", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Calculate persona counts
  const personaCounts = customerPersonas.map(persona => ({
    ...persona,
    count: customers.filter(c => c.persona === persona.name.toLowerCase()).length
  }));

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const getPersonaColor = (persona: string | null) => {
    const personaObj = customerPersonas.find(p => p.name.toLowerCase() === persona?.toLowerCase());
    return personaObj?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const openCustomerProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsProfileOpen(true);
  };

  const updateCustomer = (updates: Partial<Customer>) => {
    if (!selectedCustomer) return;
    updateCustomerMutation.mutate({ ...updates, id: selectedCustomer.id });
    setSelectedCustomer({ ...selectedCustomer, ...updates });
  };

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Customer Management"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">
              Manage your garden center customers and their gardening journey
            </p>
          </div>
          <div className="flex gap-2">
            <CustomerImportModal />
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Customer Personas Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {personaCounts.map((persona) => (
            <Card key={persona.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{persona.name}</p>
                    <p className="text-2xl font-bold">{persona.count}</p>
                  </div>
                  <Badge className={persona.color}>{persona.name}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search customers by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={personaFilter} onValueChange={setPersonaFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Personas</SelectItem>
                    <SelectItem value="newbie">Newbie</SelectItem>
                    <SelectItem value="struggler">Struggler</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={smsOptInFilter} onValueChange={setSmsOptInFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="SMS" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SMS</SelectItem>
                    <SelectItem value="true">Opted In</SelectItem>
                    <SelectItem value="false">Opted Out</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date Added</SelectItem>
                    <SelectItem value="first_name">Name</SelectItem>
                    <SelectItem value="last_purchase_date">Last Purchase</SelectItem>
                    <SelectItem value="lifetime_value">Lifetime Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading customers...</p>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || personaFilter !== 'all' || smsOptInFilter !== 'all' 
                    ? 'Try adjusting your filters or search terms'
                    : 'Start building your customer database by importing existing customers or adding them manually'
                  }
                </p>
                <div className="flex justify-center gap-2">
                  <CustomerImportModal />
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Customer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Last Purchase</TableHead>
                      <TableHead>LTV</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow 
                        key={customer.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/crm/customers/${customer.id}`)}
                      >
                        <TableCell className="font-medium">
                          {customer.first_name || customer.last_name 
                            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
                            : 'No name'
                          }
                        </TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>{customer.phone || '-'}</TableCell>
                        <TableCell>
                          {customer.persona ? (
                            <Badge className={getPersonaColor(customer.persona)}>
                              {customer.persona.charAt(0).toUpperCase() + customer.persona.slice(1)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.tags && customer.tags.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {customer.tags.slice(0, 2).map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {customer.tags.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{customer.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(customer.last_purchase_date)}</TableCell>
                        <TableCell>{formatCurrency(customer.lifetime_value)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Profile Sheet */}
        <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px]">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                Customer Profile
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetTitle>
            </SheetHeader>
            
            {selectedCustomer && (
              <div className="mt-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name</Label>
                      <Input 
                        value={selectedCustomer.first_name || ''} 
                        onChange={(e) => updateCustomer({ first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input 
                        value={selectedCustomer.last_name || ''} 
                        onChange={(e) => updateCustomer({ last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Email</Label>
                    <Input 
                      value={selectedCustomer.email} 
                      onChange={(e) => updateCustomer({ email: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      value={selectedCustomer.phone || ''} 
                      onChange={(e) => updateCustomer({ phone: e.target.value })}
                    />
                  </div>
                </div>

                {/* Persona and SMS */}
                <div className="space-y-4">
                  <div>
                    <Label>Gardening Persona</Label>
                    <Select 
                      value={selectedCustomer.persona || ''} 
                      onValueChange={(value) => updateCustomer({ persona: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select persona..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newbie">Newbie</SelectItem>
                        <SelectItem value="struggler">Struggler</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="sms-opt-in"
                          checked={selectedCustomer.sms_opt_in || false}
                          onCheckedChange={(checked) => updateCustomer({ 
                            sms_opt_in: checked,
                            sms_opt_in_at: checked ? new Date().toISOString() : null
                          })}
                        />
                        <Label htmlFor="sms-opt-in" className="font-medium">SMS Opt-in</Label>
                      </div>
                      <Badge variant={selectedCustomer.sms_opt_in ? "default" : "secondary"}>
                        {selectedCustomer.sms_opt_in ? "✅ Yes" : "❌ No"}
                      </Badge>
                    </div>
                    {selectedCustomer.sms_opt_in_at && (
                      <p className="text-xs text-muted-foreground">
                        Opted in: {format(new Date(selectedCustomer.sms_opt_in_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {selectedCustomer.tags?.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => {
                            const newTags = selectedCustomer.tags?.filter((_, i) => i !== index) || [];
                            updateCustomer({ tags: newTags });
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <Input 
                    placeholder="Add tag and press Enter..."
                    className="mt-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        const newTag = e.currentTarget.value.trim();
                        const currentTags = selectedCustomer.tags || [];
                        if (!currentTags.includes(newTag)) {
                          updateCustomer({ tags: [...currentTags, newTag] });
                        }
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>

                {/* Purchase Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lifetime Value</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={selectedCustomer.lifetime_value || ''} 
                      onChange={(e) => updateCustomer({ lifetime_value: parseFloat(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label>Last Purchase Date</Label>
                    <Input 
                      type="date"
                      value={selectedCustomer.last_purchase_date || ''} 
                      onChange={(e) => updateCustomer({ last_purchase_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button className="flex-1">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Test Email
                  </Button>
                  {selectedCustomer.sms_opt_in && (
                    <Button variant="outline" className="flex-1">
                      <Phone className="h-4 w-4 mr-2" />
                      Send SMS
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1">
                    Add to Segment
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </SubscriptionGate>
  );
};

export default CRMCustomers;