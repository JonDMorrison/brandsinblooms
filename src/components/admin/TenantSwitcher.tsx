import { useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Shield } from 'lucide-react';

export const TenantSwitcher = () => {
  const { isMasterAdmin, activeTenantId, setActiveTenantId, availableTenants } = useAdmin();

  if (!isMasterAdmin) {
    return null;
  }

  const activeTenant = availableTenants.find(t => t.id === activeTenantId);

  const tenantOptions = [
    { value: '', label: 'Select a tenant to manage' },
    ...availableTenants.map((tenant) => ({
      value: tenant.id,
      label: tenant.company_name || tenant.name
    }))
  ];

  return (
    <Card className="mb-4 border-warning/20 bg-warning/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-warning" />
          <CardTitle>Master Admin Mode</CardTitle>
        </div>
        <CardDescription>
          Select a tenant to manage their account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <NativeSelect
            value={activeTenantId || ''}
            onChange={(e) => setActiveTenantId(e.target.value || null)}
            options={tenantOptions}
            className="w-full"
          />

          {activeTenantId && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Currently Managing:</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{activeTenant?.company_name || activeTenant?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tenant ID: {activeTenantId}
              </p>
            </div>
          )}

          {activeTenantId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTenantId(null)}
              className="w-full"
            >
              Exit Tenant Management
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};