
import { CalendarView } from "@/components/CalendarView";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";

const CalendarPage = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

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

      setCampaigns(campaignsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-primary font-medium">Loading calendar...</p>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Campaign Calendar</h1>
        <p className="text-garden-green font-medium">View and schedule your marketing campaigns</p>
      </div>
      <div className="p-6 bg-white w-full">
        <CalendarView 
          campaigns={campaigns} 
          tasks={tasks}
          onDataUpdate={fetchData}
        />
      </div>
    </ProtectedPageWrapper>
  );
};

export default CalendarPage;
