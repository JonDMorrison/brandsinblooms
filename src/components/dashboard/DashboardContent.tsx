
import { CalendarView } from "@/components/CalendarView";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TeamPage } from "@/components/TeamPage";
import { CompanyProfilePage } from "@/components/CompanyProfilePage";
import { ContentGenerationControl } from "./ContentGenerationControl";
import { TaskList } from "@/components/homepage/TaskList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardContentProps {
  currentView: string;
  campaigns: any[];
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTaskUpdate: () => void;
}

export const DashboardContent = ({
  currentView,
  campaigns,
  tasks,
  onTaskClick,
  onTaskUpdate
}: DashboardContentProps) => {
  const { user } = useAuth();

  const renderContent = () => {
    switch (currentView) {
      case "home":
        return (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ContentGenerationControl 
                campaigns={campaigns}
                tasks={tasks}
                userId={user?.id}
                onTaskUpdate={onTaskUpdate}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <TaskList tasks={tasks} onTaskUpdate={onTaskUpdate} />
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Active Campaigns</span>
                      <span className="font-semibold">{campaigns.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Content Pieces</span>
                      <span className="font-semibold">{tasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Ready to Publish</span>
                      <span className="font-semibold">
                        {tasks.filter(t => t.status === 'review').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case "kanban":
        return (
          <KanbanBoard 
            tasks={tasks} 
            onTaskClick={onTaskClick}
            onTaskUpdate={onTaskUpdate}
          />
        );
      case "calendar":
        return (
          <CalendarView 
            campaigns={campaigns} 
            tasks={tasks}
            onDataUpdate={onTaskUpdate}
          />
        );
      case "team":
        return <TeamPage />;
      case "profile":
        return <CompanyProfilePage />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 p-6">
      {renderContent()}
    </div>
  );
};
