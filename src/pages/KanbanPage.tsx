
import { KanbanBoard } from "@/components/KanbanBoard";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const KanbanPage = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const { data: tasksData } = await supabase
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

      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleTaskClick = (task: any) => {
    console.log('Task clicked:', task);
    // You can add task detail modal logic here
  };

  const handleTaskUpdate = () => {
    fetchTasks();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-background">
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Content Pipeline</h1>
        <p className="text-garden-green font-medium">Manage your content creation workflow</p>
      </div>
      <div className="p-6">
        <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} onTaskUpdate={handleTaskUpdate} />
      </div>
    </div>
  );
};

export default KanbanPage;
