import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdmin } from "@/utils/adminUtils";
import { UserMenuTrigger } from "./UserMenuTrigger";
import { UserMenuContent } from "./UserMenuContent";
import { ResetAccountDialog } from "./ResetAccountDialog";
import { useUserMenuActions } from "./useUserMenuActions";

export const UserMenu = () => {
  const { user } = useAuth();
  const {
    handleNavigation,
    handleSignOut,
    handleResetAccount,
    showResetDialog,
    setShowResetDialog,
    isResetting,
    isSigningOut
  } = useUserMenuActions();

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const isAdmin = user?.email && isSuperAdmin(user.email);

  const handleAction = (action: string) => {
    switch (action) {
      case 'signout':
        handleSignOut();
        break;
      case 'reset':
        setShowResetDialog(true);
        break;
    }
  };

  return (
    <>
      <DropdownMenu>
        <UserMenuTrigger userInitials={getUserInitials()} />
        <UserMenuContent
          userEmail={user?.email}
          isAdmin={!!isAdmin}
          onNavigation={handleNavigation}
          onAction={handleAction}
          isSigningOut={isSigningOut}
        />
      </DropdownMenu>

      <ResetAccountDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={handleResetAccount}
        isResetting={isResetting}
      />
    </>
  );
};