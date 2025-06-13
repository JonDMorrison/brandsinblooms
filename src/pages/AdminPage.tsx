
import { useAuth } from "@/contexts/AuthContext";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Navigate } from "react-router-dom";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { Shield, Users, Settings, BarChart3, Database, TrendingUp, Clock, Server } from "lucide-react";
import { useState, useEffect } from "react";

const AdminPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Mock admin stats
  const [stats, setStats] = useState({
    totalUsers: 1247,
    activeUsers: 892,
    systemHealth: 98,
    dataProcessed: 45.2
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Only allow access to jon@getclear.ca
  if (!user || user.email !== "jon@getclear.ca") {
    return <Navigate to="/app" replace />;
  }

  const handleUserManagement = () => {
    console.log('User management clicked');
    // Implementation for user management
  };

  const handleSystemSettings = () => {
    console.log('System settings clicked');
    // Implementation for system settings
  };

  const handleBackupData = () => {
    console.log('Backup data clicked');
    // Implementation for data backup
  };

  const handleViewLogs = () => {
    console.log('View logs clicked');
    // Implementation for viewing system logs
  };

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                  <Shield className="w-10 h-10 text-red-600" />
                  Admin Dashboard
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  System administration and platform management
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.totalUsers.toLocaleString()}</span> total users
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{stats.activeUsers.toLocaleString()}</span> active
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Server className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.systemHealth}%</span> system health
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Database className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">{stats.dataProcessed}GB</span> processed today
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleViewLogs}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
                  size="lg"
                >
                  <BarChart3 className="w-5 h-5" />
                  View Logs
                </Button>
                
                <Button
                  onClick={handleBackupData}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 border-green-200 text-green-700"
                  size="lg"
                >
                  <Database className="w-5 h-5" />
                  Backup Data
                </Button>
                
                <Button
                  onClick={handleUserManagement}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <Users className="w-5 h-5" />
                  Manage Users
                </Button>
                
                <Button
                  onClick={handleSystemSettings}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-md"
                  size="lg"
                >
                  <Settings className="w-5 h-5" />
                  System Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Admin Content */}
        <div className="max-w-7xl mx-auto p-6">
          <AdminDashboard />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default AdminPage;
