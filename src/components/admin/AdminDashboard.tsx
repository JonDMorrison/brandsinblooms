
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMetricsSection } from "./UserMetricsSection";
import { ContentActivitySection } from "./ContentActivitySection";
import { BillingOverviewSection } from "./BillingOverviewSection";
import { UserManagementSection } from "./UserManagementSection";
import { EnhancedUserTable } from "./EnhancedUserTable";
import { useAdminData } from "@/hooks/useAdminData";
import { useAdminUsers } from "@/hooks/useAdminUsers";

export const AdminDashboard = () => {
  const { metrics, users: basicUsers, loading: metricsLoading } = useAdminData();
  const { users: detailedUsers, loading: usersLoading } = useAdminUsers();

  console.log("Basic users data:", basicUsers);
  console.log("Detailed users data:", detailedUsers);
  console.log("Metrics data:", metrics);

  if (metricsLoading && usersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-garden-green-dark">Super Admin Dashboard</h1>
          <p className="text-garden-green font-medium">Platform metrics and user management</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-8">
        {/* Section 1: User Metrics */}
        <UserMetricsSection metrics={metrics} />

        {/* Section 2: Content Activity */}
        <ContentActivitySection metrics={metrics} />

        {/* Section 3: Billing Overview */}
        <BillingOverviewSection metrics={metrics} />
      </div>

      {/* Enhanced User Management Tabs */}
      <Tabs defaultValue="detailed" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detailed">Detailed User View</TabsTrigger>
          <TabsTrigger value="overview">User Overview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="detailed">
          {usersLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </CardContent>
            </Card>
          ) : (
            <EnhancedUserTable users={detailedUsers} />
          )}
        </TabsContent>
        
        <TabsContent value="overview">
          <UserManagementSection users={basicUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
