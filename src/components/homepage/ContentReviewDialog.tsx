
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ContentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Task {
  id: string;
  status: string;
  post_type: string;
  ai_output: string;
  scheduled_date: string;
  campaign_id: string;
}

export const ContentReviewDialog = ({ open, onOpenChange }: ContentReviewDialogProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .in('status', ['draft', 'review'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to load tasks');
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      console.log('Updating task status to:', newStatus);
      
      const { error } = await supabase
        .from('content_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        toast.error(`Failed to update task: ${error.message}`);
      } else {
        toast.success(`Task ${newStatus === 'scheduled' ? 'approved' : 'updated'}`);
        fetchTasks(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'review':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Review Your Content</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No content available for review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id} className="border-garden-green-light">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <Badge variant="secondary" className={getStatusColor(task.status)}>
                        {task.status}
                      </Badge>
                      <Badge variant="outline">
                        {task.post_type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      {task.status !== 'scheduled' && (
                        <Button
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'scheduled')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {task.ai_output && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {task.ai_output}
                      </p>
                    </div>
                  )}
                  
                  {task.scheduled_date && (
                    <p className="text-xs text-gray-500 mt-2">
                      Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        <div className="flex justify-end pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-garden-green-light text-garden-green-dark"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
