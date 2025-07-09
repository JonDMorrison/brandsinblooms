import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, signOutCompletely } from "@/integrations/supabase/client";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { isSuperAdmin } from "@/utils/adminUtils";
import { toast } from "sonner";

export const useUserMenuActions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshStatus } = useOnboardingStatus();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

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

  return {
    handleNavigation,
    handleSignOut,
    handleResetAccount,
    showResetDialog,
    setShowResetDialog,
    isResetting,
    isSigningOut
  };
};