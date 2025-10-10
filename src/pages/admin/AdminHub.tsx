import { useNavigate } from 'react-router-dom';
import { useMasterAdmin } from '@/hooks/useMasterAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigate } from 'react-router-dom';
import { 
  Shield, 
  Users, 
  Search, 
  Database, 
  FileText, 
  Settings,
  BarChart3,
  Upload,
  Eye,
  Wrench,
  TrendingUp
} from 'lucide-react';

export default function AdminHub() {
  const navigate = useNavigate();
  const { data: isMasterAdmin, isLoading } = useMasterAdmin();

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

  const adminTools = [
    {
      category: 'Tenant Management',
      tools: [
        {
          title: 'All Tenants',
          description: 'View and manage all tenant accounts with filtering and pagination',
          icon: Users,
          href: '/admin/tenants',
          color: 'text-blue-500',
        },
        {
          title: 'Search Users',
          description: 'Search for specific users by email and access their tenant data',
          icon: Search,
          href: '/admin/search',
          color: 'text-purple-500',
        },
        {
          title: 'Manage Client',
          description: 'Switch context to manage a specific client account and their data',
          icon: Wrench,
          href: '/admin/manage',
          color: 'text-orange-500',
        },
      ],
    },
    {
      category: 'Data & Reporting',
      tools: [
        {
          title: 'Reports Dashboard',
          description: 'View comprehensive reports and analytics across all tenants',
          icon: BarChart3,
          href: '/admin/reports',
          color: 'text-green-500',
        },
        {
          title: 'Import Data',
          description: 'Bulk import customer data via CSV for any tenant account',
          icon: Upload,
          href: '/admin/manage',
          color: 'text-cyan-500',
        },
      ],
    },
    {
      category: 'System Tools',
      tools: [
        {
          title: 'Audit Logs',
          description: 'View all administrative actions and system events',
          icon: FileText,
          href: '/admin/tenants',
          color: 'text-yellow-500',
        },
        {
          title: 'System Settings',
          description: 'Configure global system settings and permissions',
          icon: Settings,
          href: '/admin/manage',
          color: 'text-red-500',
        },
      ],
    },
  ];

  const quickActions = [
    {
      title: 'Find User',
      description: 'Quick search by email',
      icon: Search,
      action: () => navigate('/admin/search'),
    },
    {
      title: 'View All Tenants',
      description: 'Browse tenant list',
      icon: Eye,
      action: () => navigate('/admin/tenants'),
    },
    {
      title: 'View Reports',
      description: 'Analytics dashboard',
      icon: TrendingUp,
      action: () => navigate('/admin/reports'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-destructive" />
            <div>
              <h1 className="text-3xl font-bold">Master Admin Hub</h1>
              <p className="text-muted-foreground">Central control panel for all administrative tasks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Card 
                key={action.title}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={action.action}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <action.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">{action.title}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Admin Tools by Category */}
        {adminTools.map((category) => (
          <div key={category.category}>
            <h2 className="text-xl font-semibold mb-4">{category.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.tools.map((tool) => (
                <Card key={tool.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <tool.icon className={`h-5 w-5 ${tool.color}`} />
                      <CardTitle className="text-lg">{tool.title}</CardTitle>
                    </div>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => navigate(tool.href)}
                      className="w-full"
                      variant="outline"
                    >
                      Open Tool
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Current admin session details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access Level:</span>
                <span className="font-medium">Master Administrator</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permissions:</span>
                <span className="font-medium">Full System Access</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Session Status:</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
