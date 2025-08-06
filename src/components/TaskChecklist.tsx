import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Plus, CheckCircle, X, Trash2 } from "lucide-react";

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

const getStorageKey = (weekNumber?: number) => {
  const currentWeek = weekNumber || getCurrentWeekNumber();
  return `weekly-tasks-${currentWeek}`;
};

const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const getDefaultTasks = (): ChecklistTask[] => [
  { id: "1", title: "Write social media caption", completed: false, category: "Content" },
  { id: "2", title: "Take product photos", completed: false, category: "Visual" },
  { id: "3", title: "Schedule Instagram post", completed: false, category: "Distribution" },
  { id: "4", title: "Create email newsletter content", completed: false, category: "Content" },
  { id: "5", title: "Update website banner", completed: false, category: "Web" },
  { id: "6", title: "Prepare in-store display", completed: false, category: "Store" },
];

export const TaskChecklist = ({ campaignTitle, weekNumber }: TaskChecklistProps) => {
  const currentWeek = weekNumber || getCurrentWeekNumber();
  const storageKey = getStorageKey(currentWeek);
  
  const [tasks, setTasks] = useState<ChecklistTask[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : getDefaultTasks();
  });

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("Content");
  const [visibleChecks, setVisibleChecks] = useState<string[]>([]);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks, storageKey]);

  // Reset tasks when week changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setTasks(getDefaultTasks());
    } else {
      setTasks(JSON.parse(saved));
    }
  }, [storageKey]);

  // Animate completed checkmarks sequentially
  useEffect(() => {
    const completedTasks = tasks.filter(task => task.completed);
    setVisibleChecks([]);
    
    completedTasks.forEach((task, index) => {
      setTimeout(() => {
        setVisibleChecks(prev => [...prev, task.id]);
      }, index * 200); // 200ms delay between each checkmark
    });
  }, [tasks]);

  const categories = ["Content", "Visual", "Distribution", "Web", "Store", "Planning", "Follow-up"];

  const toggleTask = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const addNewTask = () => {
    if (newTaskTitle.trim()) {
      const newTask: ChecklistTask = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        completed: false,
        category: newTaskCategory
      };
      setTasks(prev => [...prev, newTask]);
      setNewTaskTitle("");
      setIsAddingTask(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addNewTask();
    } else if (e.key === 'Escape') {
      setIsAddingTask(false);
      setNewTaskTitle("");
    }
  };

  const completedCount = tasks.filter(task => task.completed).length;
  const totalCount = tasks.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Content": return "bg-green-100 text-green-800";
      case "Visual": return "bg-blue-100 text-blue-800";
      case "Distribution": return "bg-purple-100 text-purple-800";
      case "Web": return "bg-orange-100 text-orange-800";
      case "Store": return "bg-orange-100 text-orange-800";
      case "Planning": return "bg-pink-100 text-pink-800";
      case "Follow-up": return "bg-indigo-100 text-indigo-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="shadow-lg border-green-200 rounded-xl">
      <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 rounded-t-xl">
        <CardTitle className="text-lg text-black font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            Weekly Tasks
            {campaignTitle && (
              <Badge variant="outline" className="bg-white text-black">
                {campaignTitle}
              </Badge>
            )}
          </div>
          <div className="text-sm font-medium text-black">
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
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 group ${
                  task.completed 
                    ? 'bg-green-50 border-green-200 opacity-75' 
                    : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                }`}
              >
                <div className="relative">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="h-5 w-5"
                  />
                  {task.completed && visibleChecks.includes(task.id) && (
                    <CheckCircle className="absolute -top-1 -left-1 w-7 h-7 text-green-500 animate-scale-in" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-black'}`}>
                    {task.title}
                  </p>
                </div>
                <Badge className={`${getCategoryColor(task.category)} font-medium`}>
                  {task.category}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add New Task Section */}
          {isAddingTask ? (
            <div className="space-y-3 p-4 border-2 border-dashed border-green-300 rounded-xl bg-green-50">
              <Input
                placeholder="Enter task description..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                className="border-green-300 focus:border-green-500 text-black"
                autoFocus
              />
              <div className="flex items-center gap-3">
                <NativeSelect
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value)}
                  className="w-32 border-green-300 text-black"
                  options={categories.map(category => ({
                    value: category,
                    label: category
                  }))}
                />
                <Button 
                  onClick={addNewTask}
                  size="sm"
                  className="bg-primary hover:bg-primary-600 text-white"
                  disabled={!newTaskTitle.trim()}
                >
                  Add Task
                </Button>
                <Button 
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle("");
                  }}
                  variant="outline"
                  size="sm"
                  className="border-gray-300 text-black"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setIsAddingTask(true)}
              variant="outline" 
              className="w-full border-2 border-dashed border-green-300 text-black hover:bg-green-50 font-semibold mt-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
