
import { useAuth } from "@/contexts/AuthContext";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Navigate } from "react-router-dom";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { UserMenu } from "@/components/UserMenu";
import { Shield } from "lucide-react";
import { isSuperAdmin } from "@/utils/adminUtils";

const AdminPage = () => {
  const { user } = useAuth();

  // Only allow access to super admins
  if (!user || !isSuperAdmin(user.email)) {
    return <Navigate to="/app" replace />;
  }

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header with UserMenu */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-red-600" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Super Admin</h1>
                  <p className="text-gray-600">Real-time platform administration</p>
                </div>
              </div>
              <UserMenu />
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
