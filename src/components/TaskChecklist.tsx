
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle } from "lucide-react";

interface ChecklistTask {
  id: string;
  title: string;
  completed: boolean;
  category: string;
}

interface TaskChecklistProps {
  campaignTitle?: string;
  weekNumber?: number;
}

export const TaskChecklist = ({ campaignTitle, weekNumber }: TaskChecklistProps) => {
  const [tasks, setTasks] = useState<ChecklistTask[]>([
    { id: "1", title: "Write social media caption", completed: false, category: "Content" },
    { id: "2", title: "Take product photos", completed: false, category: "Visual" },
    { id: "3", title: "Schedule Instagram post", completed: false, category: "Distribution" },
    { id: "4", title: "Create email newsletter content", completed: false, category: "Content" },
    { id: "5", title: "Update website banner", completed: false, category: "Web" },
    { id: "6", title: "Prepare in-store display", completed: false, category: "Store" },
  ]);

  const toggleTask = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  };

  const completedCount = tasks.filter(task => task.completed).length;
  const totalCount = tasks.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Content": return "bg-green-100 text-green-800";
      case "Visual": return "bg-blue-100 text-blue-800";
      case "Distribution": return "bg-purple-100 text-purple-800";
      case "Web": return "bg-orange-100 text-orange-800";
      case "Store": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
        <CardTitle className="text-lg text-garden-green-dark font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            Campaign Tasks
            {campaignTitle && (
              <Badge variant="outline" className="bg-white">
                {campaignTitle}
              </Badge>
            )}
          </div>
          <div className="text-sm font-medium">
            {completedCount}/{totalCount} ({progressPercentage}%)
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-gradient-to-r from-primary to-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 ${
                  task.completed 
                    ? 'bg-green-50 border-green-200 opacity-75' 
                    : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                }`}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id)}
                  className="h-5 w-5"
                />
                <div className="flex-1">
                  <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                    {task.title}
                  </p>
                </div>
                <Badge className={`${getCategoryColor(task.category)} font-medium`}>
                  {task.category}
                </Badge>
              </div>
            ))}
          </div>

          {/* Add New Task Button */}
          <Button 
            variant="outline" 
            className="w-full border-2 border-dashed border-green-300 text-garden-green hover:bg-green-50 font-semibold mt-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Task
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
