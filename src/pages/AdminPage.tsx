
import { useAuth } from "@/contexts/AuthContext";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Navigate } from "react-router-dom";

const AdminPage = () => {
  const { user } = useAuth();

  // Only allow access to jon@getclear.ca
  if (!user || user.email !== "jon@getclear.ca") {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <div className="max-w-7xl mx-auto p-6">
        <AdminDashboard />
      </div>
    </div>
  );
};

export default AdminPage;
