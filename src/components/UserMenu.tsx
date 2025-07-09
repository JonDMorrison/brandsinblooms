import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Settings, 
  LogOut, 
  RotateCcw, 
  AlertTriangle,
  LayoutDashboard,
  Calendar,
  Share2,
  ClipboardList,
  Building2,
  Users,
  CreditCard,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, signOutCompletely } from "@/integrations/supabase/client";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { isSuperAdmin } from "@/utils/adminUtils";
import { toast } from "sonner";

export const UserMenu = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshStatus } = useOnboardingStatus();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      console.log('🚪 UserMenu: Starting sign out process...');
      await signOutCompletely();
      toast.success('Successfully signed out');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Error signing out');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleResetAccount = async () => {
    if (!user || !isSuperAdmin(user.email)) return;
    
    setIsResetting(true);
    try {
      console.log('🔄 Starting Master Admin account reset...');
      
      const { data, error } = await supabase.rpc('reset_master_admin_account', {
        target_user_id: user.id
      });

      if (error) {
        console.error('❌ Reset error:', error);
        toast.error(`Reset failed: ${error.message}`);
        return;
      }

      console.log('✅ Account reset successful');
      toast.success('Account reset successfully! Redirecting to onboarding...');
      
      // Refresh the onboarding status to trigger re-onboarding
      await refreshStatus();
      
      // Small delay to ensure state updates
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Unexpected reset error:', error);
      toast.error(`Reset failed: ${error.message}`);
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
    }
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const isAdmin = user?.email && isSuperAdmin(user.email);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="relative h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg border-2 border-background"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60 z-[100] bg-popover border shadow-lg" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium text-sm">{user?.email}</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground">Master Admin</p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          
          {/* Navigation Section */}
          <DropdownMenuItem onClick={() => handleNavigation('/')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/calendar')}>
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/social')}>
            <Share2 className="mr-2 h-4 w-4" />
            Content Planner
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/social-media')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Analytics & Scheduling
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/content-tasks')}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Content Tasks
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/profile')}>
            <Building2 className="mr-2 h-4 w-4" />
            Company Profile
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Account Section */}
          <DropdownMenuItem onClick={() => handleNavigation('/account')}>
            <User className="mr-2 h-4 w-4" />
            Account Settings
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleNavigation('/billing')}>
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </DropdownMenuItem>
          
          {isAdmin && (
            <DropdownMenuItem onClick={() => handleNavigation('/admin')}>
              <Settings className="mr-2 h-4 w-4" />
              Admin Dashboard
            </DropdownMenuItem>
          )}
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowResetDialog(true)}
                className="text-orange-600 focus:text-orange-600"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset for Testing
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-red-600 focus:text-red-600 font-medium"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Reset Master Admin Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              <strong>This will completely reset your Master Admin account for testing:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Delete all campaigns and content tasks</li>
                <li>• Clear company profile information</li>
                <li>• Reset tokens to 100</li>
                <li>• Remove social media connections</li>
                <li>• Clear all generated content</li>
                <li>• Trigger re-onboarding process</li>
              </ul>
              <p className="mt-3 text-sm font-medium text-orange-600">
                This action cannot be undone. Only use this for testing purposes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAccount}
              disabled={isResetting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isResetting ? "Resetting..." : "Reset Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
