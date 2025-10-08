import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { TenantSwitcher } from '@/components/admin/TenantSwitcher';
import { AdminCSVImport } from '@/components/admin/AdminCSVImport';
import { Shield, Users, Database, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminManage() {
  const { isMasterAdmin, isLoading, activeTenantId } = useAdmin();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isMasterAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-warning" />
        <div>
          <h1 className="text-3xl font-bold">Master Admin Console</h1>
          <p className="text-muted-foreground">
            Manage client accounts and perform administrative actions
          </p>
        </div>
      </div>

      <TenantSwitcher />

      {activeTenantId ? (
        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="h-4 w-4 mr-2" />
              Data Import
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customer Management</CardTitle>
                <CardDescription>
                  Manage customers for the selected tenant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Navigate to the CRM section to view and manage customers for this tenant.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <AdminCSVImport />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Settings</CardTitle>
                <CardDescription>
                  Configure settings for the selected tenant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Advanced tenant configuration options will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Tenant to Manage</h3>
              <p className="text-sm text-muted-foreground">
                Choose a tenant from the dropdown above to begin managing their account
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}