
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminMetrics } from "./AdminMetrics";
import { UserManagementTable } from "./UserManagementTable";
import { PlatformAnalytics } from "./PlatformAnalytics";
import { useAdminData } from "@/hooks/useAdminData";

export const AdminDashboard = () => {
  const { metrics, users, loading } = useAdminData();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-garden-green-dark">Super Admin Dashboard</h1>
          <p className="text-garden-green font-medium">Platform metrics and user management</p>
        </div>
      </div>

      {/* Metrics Overview */}
      <AdminMetrics metrics={metrics} />

      {/* Detailed Tables */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="analytics">Platform Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Overview</CardTitle>
              <CardDescription>Complete list of users with their subscription status and activity</CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagementTable users={users} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Analytics</CardTitle>
              <CardDescription>Key performance indicators and usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformAnalytics metrics={metrics} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
