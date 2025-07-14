
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";


interface TeamInviteDialogProps {
  team: any;
  teamMembers: any[];
  onInviteSuccess: () => void;
}

export const TeamInviteDialog = ({ team, teamMembers, onInviteSuccess }: TeamInviteDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !team) {
      
      return;
    }

    const currentMemberCount = teamMembers.filter(m => m.status === 'active' || m.status === 'pending').length + 1;

    if (currentMemberCount >= team.max_members && !team.is_paid) {
      
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
        
        return;
      }

      
      setInviteEmail("");
      setInviteRole("member");
      setOpen(false);
      onInviteSuccess();
    } catch (error) {
      console.error('Error in handleInviteMember:', error);
      
    } finally {
      setIsInviting(false);
    }
  };

  const isAtLimit = teamMembers.filter(m => m.status === 'active' || m.status === 'pending').length + 1 >= (team?.max_members || 3) && !team?.is_paid;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isAtLimit} className="whitespace-nowrap">
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              placeholder="Enter email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteMember} 
              disabled={isInviting || !inviteEmail.trim()}
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
