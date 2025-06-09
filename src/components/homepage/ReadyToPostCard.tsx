
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw } from "lucide-react";
import { ReadyPostModal } from "./ReadyPostModal";
import { ReadyToPostEmptyState } from "./ready-to-post/ReadyToPostEmptyState";
import { EnhancedReadyToPostItem } from "./ready-to-post/EnhancedReadyToPostItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks, onTaskClick }: ReadyToPostCardProps) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [realtimeTasks, setRealtimeTasks] = useState(tasks);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update local state when tasks prop changes
  useEffect(() => {
    setRealtimeTasks(tasks);
  }, [tasks]);

  // Set up real-time subscription for approved content
  useEffect(() => {
    const channel = supabase
      .channel('ready-to-post-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_tasks',
          filter: 'status=eq.scheduled'
        },
        (payload) => {
          console.log('Real-time update for ready-to-post:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new.status === 'scheduled') {
              setRealtimeTasks(prev => {
                const filtered = prev.filter(task => task.id !== payload.new.id);
                return [...filtered, payload.new];
              });
              toast.success('Content approved and ready to post!');
            }
          } else if (payload.eventType === 'DELETE') {
            setRealtimeTasks(prev => prev.filter(task => task.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const readyTasks = realtimeTasks.filter(task => task.status === 'scheduled');

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskUpdate = () => {
    setIsRefreshing(true);
    // Trigger refresh if needed
    if (onTaskClick) {
      onTaskClick(selectedTask);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: freshTasks, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('status', 'scheduled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setRealtimeTasks(prev => {
        const nonScheduled = prev.filter(task => task.status !== 'scheduled');
        return [...nonScheduled, ...(freshTasks || [])];
      });
      
      toast.success('Ready to post content refreshed');
    } catch (error) {
      console.error('Error refreshing ready-to-post content:', error);
      toast.error('Failed to refresh content');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (readyTasks.length === 0) {
    return <ReadyToPostEmptyState />;
  }

  const displayedTasks = showAllTasks ? readyTasks : readyTasks.slice(0, 5);

  return (
    <>
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg text-green-800">
                Ready to Post
                <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">
                  {readyTasks.length}
                </Badge>
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-green-600 hover:bg-green-100"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription className="text-green-700">
            Your approved content is ready for publishing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayedTasks.map((task) => (
            <EnhancedReadyToPostItem
              key={task.id}
              task={task}
              onClick={handleTaskClick}
              onTaskUpdate={handleTaskUpdate}
            />
          ))}
          
          {readyTasks.length > 5 && (
            <Button 
              variant="outline" 
              className="w-full border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => setShowAllTasks(!showAllTasks)}
            >
              {showAllTasks ? 'Show Less' : `View All ${readyTasks.length} Ready Posts`}
            </Button>
          )}
        </CardContent>
      </Card>

      <ReadyPostModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onTaskUpdate={handleTaskUpdate}
      />
    </>
  );
};
