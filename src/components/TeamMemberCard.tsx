
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, Mail, RefreshCw, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TeamMemberCardProps {
  member: any;
  isOwner?: boolean;
  onMemberUpdate: () => void;
}

export const TeamMemberCard = ({ member, isOwner = false, onMemberUpdate }: TeamMemberCardProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleRemoveMember = async () => {
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', member.id);

      if (error) {
        console.error('Error removing member:', error);
        toast.error('Failed to remove team member');
        return;
      }

      toast.success(`Removed ${member.email} from team`);
      onMemberUpdate();
    } catch (error) {
      console.error('Error in handleRemoveMember:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleResendInvitation = async () => {
    setIsResending(true);
    try {
      // In a real app, this would send another email
      toast.success(`Invitation resent to ${member.email}`);
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation');
    } finally {
      setIsResending(false);
    }
  };

  if (isOwner) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-white">
              {member.email?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{member.email}</div>
            <div className="text-sm text-gray-500">Team Owner</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-500" />
          <Badge variant="secondary">Owner</Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
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
            {member.joined_at && (
              <span className="ml-2">
                • Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {member.status === 'pending' && (
          <>
            <Mail className="w-4 h-4 text-orange-500" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendInvitation}
                  disabled={isResending}
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Resend invitation</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
        <Badge variant={member.status === 'pending' ? 'outline' : 'secondary'}>
          {member.role}
        </Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {member.email} from the team? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                disabled={isRemoving}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRemoving ? 'Removing...' : 'Remove Member'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
