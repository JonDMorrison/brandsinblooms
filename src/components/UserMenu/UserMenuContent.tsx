import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { navigationItems, accountItems, adminItems, actionItems, MenuItem } from "./menuItems";

interface UserMenuContentProps {
  userEmail?: string;
  isAdmin: boolean;
  onNavigation: (path: string) => void;
  onAction: (action: string) => void;
  isSigningOut: boolean;
}

export const UserMenuContent = ({
  userEmail,
  isAdmin,
  onNavigation,
  onAction,
  isSigningOut
}: UserMenuContentProps) => {
  const renderMenuItem = (item: MenuItem) => {
    if (item.adminOnly && !isAdmin) return null;

    return (
      <DropdownMenuItem
        key={item.id}
        onClick={() => {
          if (item.path) {
            onNavigation(item.path);
          } else if (item.action) {
            onAction(item.action);
          }
        }}
        disabled={item.action === 'signout' && isSigningOut}
        className={item.className}
      >
        <item.icon className="mr-2 h-4 w-4" />
        {item.action === 'signout' && isSigningOut ? 'Signing out...' : item.label}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenuContent 
      className="w-60" 
      align="end" 
      side="bottom"
      sideOffset={8}
    >
      <div className="flex items-center justify-start gap-2 p-2">
        <div className="flex flex-col space-y-1 leading-none">
          <p className="font-medium text-sm">{userEmail}</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground">Master Admin</p>
          )}
        </div>
      </div>
      <DropdownMenuSeparator />
      
      {/* Navigation Section */}
      {navigationItems.map(renderMenuItem)}
      
      <DropdownMenuSeparator />
      
      {/* Account Section */}
      {accountItems.map(renderMenuItem)}
      
      {/* Admin Section */}
      {isAdmin && adminItems.length > 0 && (
        <>
          <DropdownMenuSeparator />
          {adminItems.map(renderMenuItem)}
        </>
      )}
      
      <DropdownMenuSeparator />
      
      {/* Action Items */}
      {actionItems.map(renderMenuItem)}
    </DropdownMenuContent>
  );
};