
import { TeamManagement } from "@/components/TeamManagement";
import { TooltipProvider } from "@/components/ui/tooltip";

export const TeamPage = () => {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-garden-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
              Team Management
            </h1>
            <p className="text-garden-green">
              Invite team members to collaborate on your marketing campaigns
            </p>
          </div>
          
          <TeamManagement />
        </div>
      </div>
    </TooltipProvider>
  );
};
