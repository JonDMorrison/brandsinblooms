
import { Homepage } from "@/components/Homepage";
import { KanbanBoard } from "@/components/KanbanBoard";
import { CalendarView } from "@/components/CalendarView";
import { TeamPage } from "@/components/TeamPage";
import { CompanyProfilePage } from "@/components/CompanyProfilePage";

interface DashboardContentProps {
  currentView: "home" | "kanban" | "calendar" | "team" | "profile";
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
  switch (currentView) {
    case "home":
      return <Homepage />;
    case "kanban":
      return <KanbanBoard tasks={tasks} onTaskClick={onTaskClick} />;
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
      return <Homepage />;
  }
};
