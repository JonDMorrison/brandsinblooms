
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Trash2, Mail, Crown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string; // Changed from union type to string to match database
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
}

export const TeamManagement = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

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

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !team) {
      toast.error('Please enter a valid email address');
      return;
    }

    const currentMemberCount = teamMembers.filter(m => m.status === 'active' || m.status === 'pending').length + 1; // +1 for owner

    if (currentMemberCount >= team.max_members && !team.is_paid) {
      toast.error(`You've reached the ${team.max_members} member limit. Upgrade to add more members.`);
      return;
    }

    setIsInviting(true);

    try {
      const { error } = await supabase
        .from('team_members')
        .insert([{
          email: inviteEmail,
          role: inviteRole,
          invited_by: user?.id,
          status: 'pending'
        }]);

      if (error) {
        console.error('Error inviting member:', error);
        toast.error('Failed to invite team member');
        return;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
      fetchTeamData();
    } catch (error) {
      console.error('Error in handleInviteMember:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) {
        console.error('Error removing member:', error);
        toast.error('Failed to remove team member');
        return;
      }

      toast.success(`Removed ${memberEmail} from team`);
      fetchTeamData();
    } catch (error) {
      console.error('Error in handleRemoveMember:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleUpgradeTeam = () => {
    toast.info('Payment integration coming soon! This will allow unlimited team members.');
    // TODO: Implement Stripe payment integration
  };

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
          <CardTitle className="flex items-center gap-3">
            <Users className="w-5 h-5" />
            Team Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  Upgrade Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite New Member */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Plus className="w-5 h-5" />
            Invite Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                type="email"
                disabled={isAtLimit}
              />
            </div>
            <div className="flex gap-2">
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={isAtLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleInviteMember} 
                disabled={isInviting || !inviteEmail.trim() || isAtLimit}
                className="whitespace-nowrap"
              >
                {isInviting ? 'Inviting...' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Owner (current user) */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-white">
                    {user?.email?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{user?.email}</div>
                  <div className="text-sm text-gray-500">Team Owner</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <Badge variant="secondary">Owner</Badge>
              </div>
            </div>

            {/* Team Members */}
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.email.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{member.email}</div>
                    <div className="text-sm text-gray-500">
                      {member.status === 'pending' ? 'Invitation pending' : 'Active member'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.status === 'pending' && <Mail className="w-4 h-4 text-orange-500" />}
                  <Badge variant={member.status === 'pending' ? 'outline' : 'secondary'}>
                    {member.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id, member.email)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {teamMembers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet. Invite your first team member above!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
