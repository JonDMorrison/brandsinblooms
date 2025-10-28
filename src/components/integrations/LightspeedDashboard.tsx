import { Card } from "@/components/ui/card";
import { Users, ShoppingBag, Package, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export const LightspeedDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['lightspeed-dashboard-stats'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: user } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!user?.tenant_id) return null;

      // Get connection info
      const { data: connection } = await supabase
        .from('lightspeed_connections')
        .select('last_synced_at')
        .eq('tenant_id', user.tenant_id)
        .single();

      // Get customers count
      const { count: customersCount } = await supabase
        .from('lightspeed_customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id);

      // Get products count
      const { count: productsCount } = await supabase
        .from('lightspeed_products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id);

      // Get this month's sales
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: monthSalesCount } = await supabase
        .from('lightspeed_sales')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id)
        .gte('sale_date', startOfMonth.toISOString());

      // Get last 7 days sales
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: weekSalesCount } = await supabase
        .from('lightspeed_sales')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', user.tenant_id)
        .gte('sale_date', sevenDaysAgo.toISOString());

      return {
        customers: customersCount || 0,
        products: productsCount || 0,
        monthSales: monthSalesCount || 0,
        weekSales: weekSalesCount || 0,
        lastSyncedAt: connection?.last_synced_at,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = stats && (stats.customers > 0 || stats.products > 0 || stats.monthSales > 0);

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
              <p className="text-2xl font-bold">{stats?.customers || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <ShoppingBag className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{stats?.monthSales || 0} sales</p>
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
              <p className="text-2xl font-bold">{stats?.weekSales || 0}</p>
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
              <p className="text-2xl font-bold">{stats?.products || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {!hasData && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Dashboard will populate after running your first sync
          </p>
        </Card>
      )}

      {stats?.lastSyncedAt && (
        <Card className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last synced {formatDistanceToNow(new Date(stats.lastSyncedAt), { addSuffix: true })}</span>
          </div>
        </Card>
      )}
    </div>
  );
};
