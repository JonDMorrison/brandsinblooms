import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, Users, ShoppingBag, DollarSign, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const LightspeedDashboard = () => {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["lightspeed-stats", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get tenant_id
      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const tenantId = userData?.tenant_id;
      if (!tenantId) throw new Error("No tenant found");

      // Get connection stats
      const { data: connection } = await supabase
        .from("lightspeed_connections")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .single();

      if (!connection) return null;

      // Get customer count
      const { count: customerCount } = await supabase
        .from("lightspeed_customers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      // Get sales this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthSalesCount } = await supabase
        .from("lightspeed_sales")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "CLOSED")
        .gte("sale_date", startOfMonth.toISOString());

      // Get product count
      const { count: productCount } = await supabase
        .from("lightspeed_products")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      // Get recent sales count
      const { count: recentSalesCount } = await supabase
        .from("lightspeed_sales")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "CLOSED")
        .gte("sale_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return {
        customerCount: customerCount || 0,
        monthSalesCount: monthSalesCount || 0,
        productCount: productCount || 0,
        recentSalesCount: recentSalesCount || 0,
        lastSync: (connection as any)?.last_customer_sync || (connection as any)?.last_sales_sync || null,
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No Lightspeed data available yet</p>
        <p className="text-sm">Run a sync to see your POS data</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customers</p>
              <p className="text-2xl font-bold">{stats.customerCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{stats.monthSalesCount} sales</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sales (7 days)</p>
              <p className="text-2xl font-bold">{stats.recentSalesCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Package className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Products</p>
              <p className="text-2xl font-bold">{stats.productCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Last synced: <span className="font-medium text-foreground">{formatDate(stats.lastSync)}</span>
        </p>
      </Card>
    </div>
  );
};
