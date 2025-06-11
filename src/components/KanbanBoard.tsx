
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Edit, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Task {
  id: string;
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
  onTaskEdit: (task: Task, editMode: boolean) => void;
  onTaskUpdate: () => void;
}

export const KanbanBoard = ({ tasks, onTaskClick, onTaskEdit, onTaskUpdate }: KanbanBoardProps) => {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEditStart = (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingTaskId(task.id);
    setEditContent(task.ai_output || "");
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditContent("");
  };

  const handleEditSave = async (taskId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ ai_output: editContent })
        .eq('id', taskId);

      if (error) {
        console.error('Error saving content:', error);
        toast.error('Failed to save content');
      } else {
        toast.success('Content updated successfully');
        setEditingTaskId(null);
        setEditContent("");
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    } finally {
      setIsSaving(false);
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
                  onClick={() => editingTaskId !== task.id && onTaskClick(task)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={getPostTypeColor(task.post_type)}>
                        {task.post_type}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">
                          {new Date(task.scheduled_date).toLocaleDateString()}
                        </span>
                        {task.ai_output && editingTaskId !== task.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleEditStart(task, e)}
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {editingTaskId === task.id ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[80px] text-sm resize-none"
                          placeholder="Edit your content..."
                        />
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleEditCancel}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleEditSave(task.id)}
                            disabled={isSaving}
                            className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
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
