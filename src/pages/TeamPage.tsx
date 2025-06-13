
import { TeamPage as TeamPageComponent } from "@/components/TeamPage";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Settings, Shield, Clock, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const TeamPage = () => {
  const [loading, setLoading] = useState(true);

  // Mock stats for demonstration
  const [stats, setStats] = useState({
    totalMembers: 8,
    activeMembers: 6,
    pendingInvites: 2,
    adminUsers: 2
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleInviteUser = () => {
    console.log('Invite user clicked');
    // Implementation for user invitation
  };

  const handleManageRoles = () => {
    console.log('Manage roles clicked');
    // Implementation for role management
  };

  const handleTeamSettings = () => {
    console.log('Team settings clicked');
    // Implementation for team settings
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
                  <Users className="w-10 h-10 text-blue-600" />
                  Team Management
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  Manage your team members and collaboration settings
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.totalMembers}</span> team members
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{stats.activeMembers}</span> active
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.pendingInvites}</span> pending invites
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">{stats.adminUsers}</span> admins
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleTeamSettings}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
                  size="lg"
                >
                  <Settings className="w-5 h-5" />
                  Team Settings
                </Button>
                
                <Button
                  onClick={handleManageRoles}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 border-green-200 text-green-700"
                  size="lg"
                >
                  <Shield className="w-5 h-5" />
                  Manage Roles
                </Button>
                
                <Button
                  onClick={handleInviteUser}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <UserPlus className="w-5 h-5" />
                  Invite Member
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Team Content */}
        <div className="max-w-7xl mx-auto p-6">
          <TeamPageComponent />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default TeamPage;
