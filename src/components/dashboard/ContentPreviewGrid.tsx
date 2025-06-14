
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Campaign } from "@/types";

interface ContentPreviewGridProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
}

export const ContentPreviewGrid = ({ campaign, onTaskUpdate }: ContentPreviewGridProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!campaign?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('campaign_id', campaign.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching tasks:', error);
        } else {
          setTasks(data || []);
        }
      } catch (error) {
        console.error('Error in fetchTasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [campaign?.id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Loading content...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No content generated yet for this campaign.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Content Preview</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium capitalize">
                  {task.post_type}
                </CardTitle>
                <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                  {task.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {task.ai_output && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {task.ai_output.substring(0, 100)}...
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(task.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
