
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TeamSettingsDialogProps {
  team: any;
  onTeamUpdate: () => void;
}

export const TeamSettingsDialog = ({ team, onTeamUpdate }: TeamSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState(team?.name || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateTeam = async () => {
    if (!teamName.trim()) {
      toast.error('Please enter a team name');
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('teams')
        .update({ name: teamName })
        .eq('id', team.id);

      if (error) {
        console.error('Error updating team:', error);
        toast.error('Failed to update team');
        return;
      }

      toast.success('Team updated successfully');
      setOpen(false);
      onTeamUpdate();
    } catch (error) {
      console.error('Error in handleUpdateTeam:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Team Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="teamName">Team Name</Label>
            <Input
              id="teamName"
              placeholder="Enter team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTeam} 
              disabled={isUpdating || !teamName.trim()}
            >
              {isUpdating ? 'Updating...' : 'Update Team'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
