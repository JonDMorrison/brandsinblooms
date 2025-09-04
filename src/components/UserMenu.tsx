import { useState, useRef, useEffect } from "react";
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
  TrendingUp,
  PlayCircle
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


export const UserMenu = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshStatus } = useOnboardingStatus();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Sign out process started
      await signOutCompletely();
      
    } catch (error) {
      // Sign out error handled
      
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleResetAccount = async () => {
    if (!user || !isSuperAdmin(user.email)) return;
    
    setIsResetting(true);
    try {
      // Starting account reset
      
      const { data, error } = await supabase.rpc('reset_master_admin_account', {
        target_user_id: user.id
      });

      if (error) {
        // Reset error handled
        return;
      }

      // Account reset successful
      
      
      // Refresh the onboarding status to trigger re-onboarding
      await refreshStatus();
      
      // Small delay to ensure state updates
      setTimeout(() => {
        navigate('/onboarding', { replace: true });
      }, 1000);
      
    } catch (error: any) {
      // Unexpected reset error
      
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
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200 shadow-lg border-2 border-background"
          onClick={() => {
            // Toggle dropdown
            setIsDropdownOpen(!isDropdownOpen);
          }}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
        
        {isDropdownOpen && (
          <div className="absolute right-0 top-12 w-60 z-[200] bg-white text-black border border-gray-300 shadow-xl rounded-md p-2">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium text-sm">{user?.email}</p>
                {isAdmin && (
                  <p className="text-xs text-gray-600">Master Admin</p>
                )}
              </div>
            </div>
            <hr className="my-1" />
            
            {/* Navigation Section */}
            <div className="py-1">
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/calendar')}>
                <Calendar className="mr-2 h-4 w-4" />
                Calendar
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/social')}>
                <Share2 className="mr-2 h-4 w-4" />
                Content Planner
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => {
                sessionStorage.setItem('startProductTour', 'true');
                navigate('/dashboard');
                setIsDropdownOpen(false);
              }}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Product Tour
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/social-media')}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics & Scheduling
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/content-tasks')}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Content Tasks
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/profile')}>
                <Building2 className="mr-2 h-4 w-4" />
                Company Profile
              </button>
            </div>
            
            <hr className="my-1" />
            
            {/* Account Section */}
            <div className="py-1">
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/account')}>
                <User className="mr-2 h-4 w-4" />
                Account Settings
              </button>
              
              <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/billing')}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </button>
              
              {isAdmin && (
                <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center" onClick={() => handleNavigation('/admin')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Admin Dashboard
                </button>
              )}
              
              {isAdmin && (
                <>
                  <hr className="my-1" />
                  <button 
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center text-orange-600"
                    onClick={() => setShowResetDialog(true)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset for Testing
                  </button>
                </>
              )}
            </div>
            
            <hr className="my-1" />
            <button 
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center text-red-600 font-medium"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        )}
      </div>

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
                This action cannot be undone.  Only use this for testing purposes.
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
