
import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppSidebar } from "@/components/AppSidebar";
import { Homepage } from "@/components/Homepage";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CalendarView } from "@/components/CalendarView";
import { LandingPage } from "@/components/LandingPage";
import { ContentSidebar } from "@/components/ContentSidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  onboardingData: any;
}

export const Dashboard = ({ onboardingData }: DashboardProps) => {
  const [currentView, setCurrentView] = useState<"home" | "kanban" | "calendar">("home");
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch campaigns
        const { data: campaignsData, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .order('start_date', { ascending: true });

        if (campaignsError) {
          console.error('Error fetching campaigns:', campaignsError);
        } else {
          setCampaigns(campaignsData || []);
        }

        // Fetch content tasks with campaign info
        const { data: tasksData, error: tasksError } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns (
              title,
              week_number,
              start_date
            )
          `)
          .order('scheduled_date', { ascending: true });

        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
        } else {
          setTasks(tasksData || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading your marketing hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <Tabs defaultValue="app" className="w-full">
        <div className="border-b border-green-200 bg-white px-6 py-2">
          <TabsList className="grid w-fit grid-cols-2">
            <TabsTrigger value="app">App View</TabsTrigger>
            <TabsTrigger value="landing">Landing Preview</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="app" className="mt-0">
          <SidebarProvider>
            <div className="min-h-screen flex w-full bg-garden-background">
              <AppSidebar 
                currentView={currentView} 
                onViewChange={setCurrentView}
                onboardingData={onboardingData}
              />
              
              <main className="flex-1 flex">
                <div className="flex-1">
                  {currentView !== "home" && (
                    <div className="p-6 border-b border-green-200 bg-white">
                      <div className="flex justify-between items-center">
                        <div>
                          <h1 className="text-3xl font-bold text-garden-green-dark">
                            {getViewTitle()}
                          </h1>
                          <p className="text-garden-green font-medium">
                            {getViewDescription()}
                          </p>
                        </div>
                        <Button className="bg-primary hover:bg-primary-600 text-white shadow-md">
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
                        campaigns={campaigns}
                        tasks={tasks}
                      />
                    )}
                    {currentView === "kanban" && (
                      <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} />
                    )}
                    {currentView === "calendar" && (
                      <CalendarView campaigns={campaigns} />
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
        </TabsContent>

        <TabsContent value="landing" className="mt-0">
          <div className="min-h-screen overflow-auto">
            <LandingPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
