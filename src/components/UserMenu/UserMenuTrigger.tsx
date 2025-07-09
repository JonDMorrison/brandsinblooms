import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface UserMenuTriggerProps {
  userInitials: string;
}

export const UserMenuTrigger = ({ userInitials }: UserMenuTriggerProps) => {
  return (
    <DropdownMenuTrigger asChild>
      <Button 
        variant="ghost" 
        className="relative h-10 w-10 rounded-full bg-[#68BEB9] hover:bg-[#5AA8A3] transition-all duration-200 shadow-lg border-2 border-white"
        onClick={() => console.log('🔍 UserMenuTrigger clicked')}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[#3E5A6B] text-white text-sm font-semibold">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Button>
    </DropdownMenuTrigger>
  );
};