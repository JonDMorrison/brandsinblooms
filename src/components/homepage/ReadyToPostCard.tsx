
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, RefreshCw, Clock } from "lucide-react";
import { ReadyPostModal } from "./ReadyPostModal";
import { ReadyToPostEmptyState } from "./ready-to-post/ReadyToPostEmptyState";
import { EnhancedReadyToPostItem } from "./ready-to-post/EnhancedReadyToPostItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskClick?: (task: any) => void;
  onTaskUpdate?: () => void;
}

export const ReadyToPostCard = ({ tasks, onTaskClick, onTaskUpdate }: ReadyToPostCardProps) => {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [realtimeTasks, setRealtimeTasks] = useState(tasks);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update local state when tasks prop changes
  useEffect(() => {
    setRealtimeTasks(tasks);
  }, [tasks]);

  // Set up real-time subscription for posted content only
  useEffect(() => {
    const channel = supabase
      .channel('ready-to-post-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_tasks',
          filter: 'status=eq.posted'
        },
        (payload) => {
          console.log('Real-time update for ready-to-post:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (payload.new.status === 'posted') {
              // Check if content is within 2 weeks
              const updatedAt = new Date(payload.new.updated_at);
              const twoWeeksAgo = new Date();
              twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
              
              if (updatedAt > twoWeeksAgo) {
                setRealtimeTasks(prev => {
                  const filtered = prev.filter(task => task.id !== payload.new.id);
                  return [...filtered, payload.new];
                });
                toast.success('Content approved and ready to post!');
              }
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

  // Filter for only posted content from the last 2 weeks
  // RLS will ensure we only see our own content
  const readyTasks = realtimeTasks.filter(task => {
    if (task.status !== 'posted') return false;
    
    // Check if content is within 2 weeks
    const updatedAt = new Date(task.updated_at);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    return updatedAt > twoWeeksAgo;
  });

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
    if (onTaskUpdate) {
      onTaskUpdate();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Calculate 2 weeks ago
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Fetch user's posted content with RLS protection
      const { data: freshTasks, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id
          )
        `)
        .eq('status', 'posted')
        .gte('updated_at', twoWeeksAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('ReadyToPost: Refreshed tasks for current user:', freshTasks?.length);
      
      setRealtimeTasks(prev => {
        const nonPosted = prev.filter(task => task.status !== 'posted');
        return [...nonPosted, ...(freshTasks || [])];
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
          <CardDescription className="text-green-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Your approved content (available for 2 weeks)
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
