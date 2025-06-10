
import { CalendarView } from "@/components/CalendarView";
import { UserMenu } from "@/components/UserMenu";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-black">Campaign Calendar</h1>
            <p className="text-gray-600 font-medium">View and schedule your marketing campaigns</p>
          </div>
          <UserMenu />
        </div>
      </div>
      <div className="p-6 bg-white">
        <CalendarView 
          campaigns={campaigns} 
          tasks={tasks}
          onDataUpdate={fetchData}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
