
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Search, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TeamInviteDialog } from "./TeamInviteDialog";
import { TeamSettingsDialog } from "./TeamSettingsDialog";
import { TeamMemberCard } from "./TeamMemberCard";
import { TeamActivity } from "./TeamActivity";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  joined_at?: string;
  user_id?: string;
}

interface Team {
  id: string;
  name: string;
  max_members: number;
  is_paid: boolean;
  owner_id: string;
  created_at: string;
}

export const TeamManagement = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) {
      fetchTeamData();
    }
  }, [user]);

  const fetchTeamData = async () => {
    try {
      // Fetch team data
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('owner_id', user?.id)
        .single();

      if (teamError && teamError.code !== 'PGRST116') {
        console.error('Error fetching team:', teamError);
        toast.error('Failed to load team data');
        return;
      }

      if (!teamData) {
        // Create a team if none exists
        const { data: newTeam, error: createError } = await supabase
          .from('teams')
          .insert([{ owner_id: user?.id, name: 'My Team' }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating team:', createError);
          toast.error('Failed to create team');
          return;
        }
        setTeam(newTeam);
      } else {
        setTeam(teamData);
      }

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('invited_by', user?.id)
        .order('invited_at', { ascending: false });

      if (membersError) {
        console.error('Error fetching team members:', membersError);
        toast.error('Failed to load team members');
        return;
      }

      setTeamMembers(membersData || []);
    } catch (error) {
      console.error('Error in fetchTeamData:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeTeam = () => {
    toast.info('Payment integration coming soon! This will allow unlimited team members.');
  };

  const filteredMembers = teamMembers.filter(member =>
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeMemberCount = teamMembers.filter(m => m.status === 'active' || m.status === 'pending').length + 1;
  const isAtLimit = activeMemberCount >= (team?.max_members || 3) && !team?.is_paid;

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              Team Overview
            </CardTitle>
            <TeamSettingsDialog team={team} onTeamUpdate={fetchTeamData} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-primary">{activeMemberCount}</div>
              <div className="text-sm text-gray-600">Active Members</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{team?.max_members || 3}</div>
              <div className="text-sm text-gray-600">Member Limit</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {team?.is_paid ? 'Pro' : 'Free'}
              </div>
              <div className="text-sm text-gray-600">Plan Type</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {teamMembers.filter(m => m.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending Invites</div>
            </div>
          </div>

          {isAtLimit && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-orange-800">Team Limit Reached</h4>
                  <p className="text-sm text-orange-600">
                    Upgrade to Pro to add unlimited team members
                  </p>
                </div>
                <Button onClick={handleUpgradeTeam} className="bg-orange-600 hover:bg-orange-700">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <TeamInviteDialog 
                  team={team} 
                  teamMembers={teamMembers} 
                  onInviteSuccess={fetchTeamData} 
                />
              </div>
              {teamMembers.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search team members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Owner (current user) */}
                <TeamMemberCard 
                  member={{ email: user?.email }} 
                  isOwner={true} 
                  onMemberUpdate={fetchTeamData} 
                />

                {/* Team Members */}
                {filteredMembers.map((member) => (
                  <TeamMemberCard 
                    key={member.id} 
                    member={member} 
                    onMemberUpdate={fetchTeamData} 
                  />
                ))}

                {teamMembers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No team members yet. Invite your first team member above!</p>
                  </div>
                )}

                {filteredMembers.length === 0 && teamMembers.length > 0 && searchTerm && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No members found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="space-y-6">
          <TeamActivity teamMembers={teamMembers} />
          
          {/* Team Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5" />
                Team Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Invitations Sent</span>
                  <Badge variant="outline">{teamMembers.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accepted Invitations</span>
                  <Badge variant="outline">
                    {teamMembers.filter(m => m.status === 'active').length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Invitations</span>
                  <Badge variant="outline">
                    {teamMembers.filter(m => m.status === 'pending').length}
                  </Badge>
                </div>
                {team?.created_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Team Created</span>
                    <Badge variant="outline">
                      {new Date(team.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
