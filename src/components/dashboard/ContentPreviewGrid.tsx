
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

  // Don't render anything - Content Preview section removed
  return null;
};
