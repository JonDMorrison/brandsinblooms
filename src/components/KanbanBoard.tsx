
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: number;
  status: string;
  scheduled_date: string;
  ai_output: string;
  post_type: string;
  hashtags: string;
  image_idea: string;
  notes: string;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate: () => void;
}

export const KanbanBoard = ({ tasks, onTaskClick, onTaskUpdate }: KanbanBoardProps) => {
  const columns = [
    { id: "planned", title: "Planned", color: "bg-gray-50 border-gray-200" },
    { id: "generating", title: "Generating", color: "bg-blue-50 border-blue-200" },
    { id: "review", title: "Review", color: "bg-yellow-50 border-yellow-200" },
    { id: "scheduled", title: "Scheduled", color: "bg-green-50 border-green-200" },
    { id: "posted", title: "Posted", color: "bg-emerald-50 border-emerald-200" },
    { id: "skipped", title: "Skipped", color: "bg-red-50 border-red-200" }
  ];

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case "instagram": return "bg-pink-100 text-pink-800";
      case "facebook": return "bg-blue-100 text-blue-800";
      case "email": return "bg-purple-100 text-purple-800";
      case "blog": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="grid grid-cols-6 gap-4 h-full">
      {columns.map((column) => {
        const columnTasks = tasks.filter(task => task.status === column.id);
        
        return (
          <div key={column.id} className={`${column.color} rounded-lg p-4 border-2`}>
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center justify-between">
              {column.title}
              <Badge variant="secondary" className="bg-white">
                {columnTasks.length}
              </Badge>
            </h3>
            
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onTaskClick(task)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={getPostTypeColor(task.post_type)}>
                        {task.post_type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(task.scheduled_date).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {task.ai_output ? (
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {task.ai_output}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        Content being generated...
                      </p>
                    )}
                    {task.image_idea && (
                      <p className="text-xs text-green-600 mt-2">
                        💡 {task.image_idea}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No tasks</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
