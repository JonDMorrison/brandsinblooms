
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, TrendingUp, Database, Crown, Activity } from "lucide-react";
import { toast } from "sonner";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface UserData {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  campaignCount: number;
  taskCount: number;
}

export const AdminDashboard = () => {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    totalCampaigns: 0,
    totalTasks: 0,
    activeSubscriptions: 0,
    freeTrialUsers: 0,
    paidUsers: 0
  });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch basic metrics
      const [
        { count: usersCount },
        { count: campaignsCount },
        { count: tasksCount },
        { data: subscriptions }
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('content_tasks').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*')
      ]);

      // Calculate subscription metrics
      const activeSubscriptions = subscriptions?.filter(sub => 
        new Date(sub.end_date) > new Date()
      ).length || 0;

      const freeTrialUsers = subscriptions?.filter(sub => 
        sub.plan === 'free_trial'
      ).length || 0;

      const paidUsers = subscriptions?.filter(sub => 
        sub.plan !== 'free_trial'
      ).length || 0;

      setMetrics({
        totalUsers: usersCount || 0,
        totalCampaigns: campaignsCount || 0,
        totalTasks: tasksCount || 0,
        activeSubscriptions,
        freeTrialUsers,
        paidUsers
      });

      // Fetch detailed user data with their campaigns and tasks
      const { data: detailedUsers } = await supabase
        .from('users')
        .select(`
          id,
          email,
          created_at,
          subscriptions (
            plan,
            end_date
          )
        `)
        .order('created_at', { ascending: false });

      if (detailedUsers) {
        const usersWithStats = await Promise.all(
          detailedUsers.map(async (user) => {
            // Get campaign count for user (assuming campaigns are user-specific)
            const { count: campaignCount } = await supabase
              .from('campaigns')
              .select('*', { count: 'exact', head: true });

            // Get task count for user
            const { count: taskCount } = await supabase
              .from('content_tasks')
              .select('*', { count: 'exact', head: true });

            const subscription = user.subscriptions?.[0];
            const isActive = subscription && new Date(subscription.end_date) > new Date();

            return {
              id: user.id,
              email: user.email,
              created_at: user.created_at,
              plan: subscription?.plan || 'No Plan',
              status: isActive ? 'Active' : 'Inactive',
              campaignCount: campaignCount || 0,
              taskCount: taskCount || 0
            };
          })
        );

        setUsers(usersWithStats);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'bloom': return 'bg-purple-100 text-purple-800';
      case 'sprout': return 'bg-green-100 text-green-800';
      case 'free_trial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">Created campaigns</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Tasks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{metrics.totalTasks}</div>
            <p className="text-xs text-muted-foreground">Generated content</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Free Trial Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.freeTrialUsers}</div>
            <p className="text-xs text-muted-foreground">On free trial</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Users</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{metrics.paidUsers}</div>
            <p className="text-xs text-muted-foreground">Paying customers</p>
          </CardContent>
        </Card>
      </div>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Content Tasks</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getPlanBadgeColor(user.plan)}>
                          {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeColor(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.campaignCount}</TableCell>
                      <TableCell>{user.taskCount}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Subscription Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Free Trial:</span>
                      <span className="font-medium">{metrics.freeTrialUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid Users:</span>
                      <span className="font-medium">{metrics.paidUsers}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Total:</span>
                      <span className="font-semibold">{metrics.totalUsers}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Content Statistics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Campaigns:</span>
                      <span className="font-medium">{metrics.totalCampaigns}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Content Tasks:</span>
                      <span className="font-medium">{metrics.totalTasks}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Avg Tasks/Campaign:</span>
                      <span className="font-semibold">
                        {metrics.totalCampaigns > 0 
                          ? Math.round(metrics.totalTasks / metrics.totalCampaigns) 
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
