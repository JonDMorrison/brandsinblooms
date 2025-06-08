
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMetricsSection } from "./UserMetricsSection";
import { ContentActivitySection } from "./ContentActivitySection";
import { BillingOverviewSection } from "./BillingOverviewSection";
import { UserManagementSection } from "./UserManagementSection";
import { useAdminData } from "@/hooks/useAdminData";

export const AdminDashboard = () => {
  const { metrics, users, loading } = useAdminData();

  console.log("Users data:", users);
  console.log("Metrics data:", metrics);

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

      {/* Section 4: User Management */}
      <UserManagementSection users={users} />
    </div>
  );
};
