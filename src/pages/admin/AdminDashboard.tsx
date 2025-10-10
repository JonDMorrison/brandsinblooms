import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMasterAdmin } from '@/hooks/useMasterAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, Building2, Calendar, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const [searchEmail, setSearchEmail] = useState('');
  const { data: isMasterAdmin, isLoading: checkingAdmin } = useMasterAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ['admin-tenants', searchEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_tenant_overview')
        .select('*')
        .ilike('primary_contact_email', `%${searchEmail}%`)
        .order('tenant_created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: isMasterAdmin && searchEmail.length > 0,
  });

  const switchContextMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('admin_session_context')
        .upsert({
          admin_user_id: user.id,
          active_tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Context switched',
        description: 'You are now viewing data for the selected tenant',
      });
      queryClient.invalidateQueries({ queryKey: ['crm_customers'] });
      queryClient.invalidateQueries({ queryKey: ['crm_campaigns'] });
    },
    onError: (error) => {
      toast({
        title: 'Error switching context',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="container mx-auto p-8">
        <p>Checking permissions...</p>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have master admin privileges</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Master Admin Dashboard</h1>
        <p className="text-muted-foreground">Search and manage tenant accounts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search User by Email</CardTitle>
          <CardDescription>Enter an email address to find their tenant information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="christine@dwntoearth.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] })}
              disabled={!searchEmail}
            >
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadingTenants && (
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">Searching...</p>
          </CardContent>
        </Card>
      )}

      {tenants && tenants.length === 0 && (
        <Card>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">No tenants found for "{searchEmail}"</p>
          </CardContent>
        </Card>
      )}

      {tenants && tenants.length > 0 && (
        <div className="space-y-4">
          {tenants.map((tenant) => (
            <Card key={tenant.tenant_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      {tenant.company_name || 'Unnamed Company'}
                    </CardTitle>
                    <CardDescription>{tenant.primary_contact_email}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {tenant.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {tenant.is_trialing && <Badge variant="outline">Trial</Badge>}
                    {tenant.is_paid_active && <Badge variant="default">Paid</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <p className="font-medium">{tenant.plan || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{tenant.subscription_status || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created
                    </p>
                    <p className="font-medium">
                      {tenant.tenant_created_at 
                        ? new Date(tenant.tenant_created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">
                      {[tenant.city, tenant.region, tenant.country].filter(Boolean).join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>

                {tenant.trial_end && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Trial ends:</span>{' '}
                      {new Date(tenant.trial_end).toLocaleDateString()}
                      {tenant.trial_not_expired && ' (Active)'}
                    </p>
                  </div>
                )}

                <Button 
                  onClick={() => switchContextMutation.mutate(tenant.tenant_id!)}
                  disabled={switchContextMutation.isPending}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View Tenant Data
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
