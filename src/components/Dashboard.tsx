
import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Homepage } from "@/components/Homepage";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CalendarView } from "@/components/CalendarView";
import { ContentSidebar } from "@/components/ContentSidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DashboardProps {
  onboardingData: any;
}

export const Dashboard = ({ onboardingData }: DashboardProps) => {
  const [currentView, setCurrentView] = useState<"home" | "kanban" | "calendar">("home");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Mock data - in real app this would come from a database
  const mockCampaigns = [
    { id: 1, week_number: 1, start_date: "2024-06-03", title: "Spring Garden Prep Week" },
    { id: 2, week_number: 2, start_date: "2024-06-10", title: "Mother's Day Plant Sale" },
    { id: 3, week_number: 3, start_date: "2024-06-17", title: "Summer Herb Workshop" },
  ];

  const mockTasks = [
    {
      id: 1,
      campaign_id: 1,
      status: "planned",
      scheduled_date: "2024-06-05",
      ai_output: "🌱 Spring is here! Time to prep your garden for the growing season. Visit us for organic soil amendments, starter plants, and expert advice. #SpringGardening #OrganicGardening",
      post_type: "instagram",
      hashtags: "#SpringGardening #OrganicGardening #GardenPrep",
      image_idea: "Fresh soil and seedlings arrangement",
      notes: "Focus on early spring activities"
    },
    {
      id: 2,
      campaign_id: 1,
      status: "generating",
      scheduled_date: "2024-06-06",
      ai_output: "",
      post_type: "facebook",
      hashtags: "",
      image_idea: "Garden tools display",
      notes: "Highlight tool sale"
    },
    {
      id: 3,
      campaign_id: 2,
      status: "review",
      scheduled_date: "2024-06-12",
      ai_output: "💐 Make Mom's Day special with our beautiful selection of flowering plants! From vibrant petunias to fragrant lavender, we have the perfect gift to show your love. Special Mother's Day pricing all week!",
      post_type: "email",
      hashtags: "#MothersDay #FlowerGifts #SpringBlooms",
      image_idea: "Beautiful hanging baskets and potted flowers",
      notes: "Emphasize gift aspect"
    }
  ];

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsSidebarOpen(true);
  };

  const getViewTitle = () => {
    switch (currentView) {
      case "home": return "Dashboard Overview";
      case "kanban": return "Content Pipeline";
      case "calendar": return "Campaign Calendar";
      default: return "Dashboard";
    }
  };

  const getViewDescription = () => {
    switch (currentView) {
      case "home": return "Your marketing hub at a glance";
      case "kanban": return "Manage your content creation workflow";
      case "calendar": return "View and schedule your marketing campaigns";
      default: return "";
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar 
          currentView={currentView} 
          onViewChange={setCurrentView}
          onboardingData={onboardingData}
        />
        
        <main className="flex-1 flex">
          <div className="flex-1">
            {currentView !== "home" && (
              <div className="p-6 border-b border-green-100">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-bold text-green-800">
                      {getViewTitle()}
                    </h1>
                    <p className="text-green-600">
                      {getViewDescription()}
                    </p>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Campaign
                  </Button>
                </div>
              </div>
            )}

            <div className={currentView !== "home" ? "p-6" : ""}>
              {currentView === "home" && (
                <Homepage 
                  onboardingData={onboardingData}
                  onNavigateToKanban={() => setCurrentView("kanban")}
                  onTaskClick={handleTaskClick}
                />
              )}
              {currentView === "kanban" && (
                <KanbanBoard tasks={mockTasks} onTaskClick={handleTaskClick} />
              )}
              {currentView === "calendar" && (
                <CalendarView campaigns={mockCampaigns} />
              )}
            </div>
          </div>

          {isSidebarOpen && selectedTask && (
            <ContentSidebar 
              task={selectedTask} 
              onClose={() => setIsSidebarOpen(false)}
            />
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};
