import React, { useState, useEffect, useRef } from 'react';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/NativeSelect';
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
import { EnhancedSegmentImportDialog } from '@/components/crm/segments/EnhancedSegmentImportDialog';
import { CustomerPersonaSelector } from '@/components/crm/CustomerPersonaSelector';
import { CustomerSegmentSelector } from '@/components/crm/CustomerSegmentSelector';

type Customer = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  persona: string | null;
  persona_id: string | null;
  personas?: {
    id: string;
    name: string;
    icon: string;
    color_theme: string;
  } | null;
  segments?: {
    id: string;
    name: string;
    description: string | null;
  }[] | null;
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
  const [currentPage, setCurrentPage] = useState(1);
const [pageSize] = useState(100); // 100 customers per page
  const [totalCount, setTotalCount] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // FIX: [issue #25] - Fetch personas from DB instead of using hardcoded string names
  const { data: personaOptions = [] } = useQuery({
    queryKey: ['crm-persona-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_personas')
        .select('id, persona_name, icon, color_theme')
        .order('persona_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch customers with pagination
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['crm-customers', searchTerm, personaFilter, smsOptInFilter, sortBy, currentPage, pageSize],
    queryFn: async () => {
      // Build base query with filters
      let query = supabase
        .from('crm_customers')
        .select(`
          *,
          personas:persona_id (
            id,
            name,
            icon,
            color_theme
          )
        `, { count: 'exact' });

      // Apply search filter
      if (searchTerm) {
        // FIX: [issue #46] - Sanitize search term to prevent PostgREST filter injection
        const sanitizeForPostgrest = (input: string) => input.replace(/[,.()"'\\]/g, '');
        const safeSearch = sanitizeForPostgrest(searchTerm);
        query = query.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
      }

      // Apply persona filter
      if (personaFilter !== 'all') {
        query = query.eq('persona_id', personaFilter);
      }

      // Apply SMS opt-in filter
      if (smsOptInFilter !== 'all') {
        query = query.eq('sms_opt_in', smsOptInFilter === 'true');
      }

      // Apply sorting and pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      query = query
        .order(sortBy, { ascending: sortBy === 'first_name' })
        .range(from, to);

      const { data: customersData, error: customersError, count } = await query;
      if (customersError) throw customersError;

      // Update total count for pagination
      setTotalCount(count || 0);

      // FIX: [issue #33] - Batched segment lookup instead of N+1 queries per customer
      const customerIds = (customersData || []).map(c => c.id);
      let customerSegmentMap: Record<string, { id: string; name: string; description: string | null }[]> = {};

      if (customerIds.length > 0) {
        const { data: allCustomerSegments } = await supabase
          .from('customer_segments')
          .select('customer_id, segment_id')
          .in('customer_id', customerIds);

        if (allCustomerSegments && allCustomerSegments.length > 0) {
          const uniqueSegmentIds = [...new Set(allCustomerSegments.map(cs => cs.segment_id))];
          const { data: allSegments } = await supabase
            .from('crm_segments')
            .select('id, name, description')
            .in('id', uniqueSegmentIds);

          const segmentLookup = new Map((allSegments || []).map(s => [s.id, s]));
          for (const cs of allCustomerSegments) {
            if (!customerSegmentMap[cs.customer_id]) {
              customerSegmentMap[cs.customer_id] = [];
            }
            const seg = segmentLookup.get(cs.segment_id);
            if (seg) {
              customerSegmentMap[cs.customer_id].push(seg);
            }
          }
        }
      }

      const customersWithSegments = (customersData || []).map(customer => ({
        ...customer,
        segments: customerSegmentMap[customer.id] || []
      }));

      return customersWithSegments as Customer[];
    }
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

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
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const openCustomerProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsProfileOpen(true);
  };

  // FIX: [issue #12] - Debounce customer edit mutations to prevent firing on every keystroke
  const debouncedUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCustomer = (updates: Partial<Customer>) => {
    if (!selectedCustomer) return;
    setSelectedCustomer({ ...selectedCustomer, ...updates });
    if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    debouncedUpdateRef.current = setTimeout(() => {
      updateCustomerMutation.mutate({ ...updates, id: selectedCustomer.id });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    };
  }, []);

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
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => navigate('/crm/customers/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>


        {/* Customer Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Customer List</CardTitle>
            <Badge variant="secondary" className="text-sm">
              {totalCount.toLocaleString()} total customers
            </Badge>
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
                <NativeSelect
                  value={personaFilter}
                  onChange={(e) => setPersonaFilter(e.target.value)}
                  className="w-[140px]"
                  placeholder="Persona"
                  options={[
                    { value: 'all', label: 'All Personas' },
                    ...personaOptions.map((p) => ({
                      value: p.id,
                      label: p.persona_name,
                    }))
                  ]}
                />

                <NativeSelect
                  value={smsOptInFilter}
                  onChange={(e) => setSmsOptInFilter(e.target.value)}
                  className="w-[120px]"
                  placeholder="SMS"
                  options={[
                    { value: 'all', label: 'All SMS' },
                    { value: 'true', label: 'Opted In' },
                    { value: 'false', label: 'Opted Out' }
                  ]}
                />

                <NativeSelect
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-[140px]"
                  placeholder="Sort by"
                  options={[
                    { value: 'created_at', label: 'Date Added' },
                    { value: 'first_name', label: 'Name' },
                    { value: 'last_purchase_date', label: 'Last Purchase' },
                    { value: 'lifetime_value', label: 'Lifetime Value' }
                  ]}
                />
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
                  <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                  <Button onClick={() => navigate('/crm/customers/new')}>
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
                      <TableHead>Segments</TableHead>
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
                        onClick={() => openCustomerProfile(customer)}
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
                          {customer.personas ? (
                            <Badge 
                              className="inline-flex items-center gap-1"
                              style={{ 
                                backgroundColor: customer.personas.color_theme + '20',
                                color: customer.personas.color_theme,
                                borderColor: customer.personas.color_theme + '40'
                              }}
                            >
                              <span className="text-sm">{customer.personas.icon}</span>
                              {customer.personas.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.segments && customer.segments.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {customer.segments.slice(0, 2).map((segment, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {segment.name}
                                </Badge>
                              ))}
                              {customer.segments.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{customer.segments.length - 2}
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

            {/* Pagination Controls */}
            {!isLoading && customers.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} customers
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={!hasPrevPage}
                  >
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={!hasPrevPage}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasNextPage}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={!hasNextPage}
                  >
                    Last
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Profile Sheet */}
        <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <SheetContent className="w-[600px] sm:max-w-[600px] bg-white">
            <SheetHeader>
              <SheetTitle>Customer Profile</SheetTitle>
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

                {/* Persona Selection */}
                <div className="space-y-4">
                   <CustomerPersonaSelector 
                     value={selectedCustomer.persona_id}
                      onChange={(personaIds) => {
                        // Update local state and refresh customer data 
                        setSelectedCustomer(prev => prev ? { ...prev, persona_id: personaIds[0] || null } : null);
                        queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
                      }}
                     customerId={selectedCustomer.id}
                   />

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

                {/* Segment Management */}
                <CustomerSegmentSelector customerId={selectedCustomer.id} />

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
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <EnhancedSegmentImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['crm-customers'] });
          }}
        />
      </div>
    </SubscriptionGate>
  );
};

export default CRMCustomers;