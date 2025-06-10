
import { TeamManagement } from "@/components/TeamManagement";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const TeamPage = () => {
  const navigate = useNavigate();

  const handleReturnToDashboard = () => {
    navigate('/app');
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-garden-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={handleReturnToDashboard}
              className="mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return To Dashboard
            </Button>
          </div>
          
          <TeamManagement />
        </div>
      </div>
    </TooltipProvider>
  );
};
