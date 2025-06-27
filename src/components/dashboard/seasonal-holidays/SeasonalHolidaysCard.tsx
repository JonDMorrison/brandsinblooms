import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HolidayItem } from "./HolidayItem";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FivePostModal } from "@/components/shared/FivePostModal";

interface Holiday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  description?: string;
  theme?: string;
}

interface ContentState {
  contentCount: number;
}

interface SeasonalHolidaysCardProps {
  onContentGenerated?: () => void;
}

export const SeasonalHolidaysCard = ({ onContentGenerated }: SeasonalHolidaysCardProps) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [contentStates, setContentStates] = useState<Record<string, ContentState>>({});
  const [holidayTasksMap, setHolidayTasksMap] = useState<Record<string, any[]>>({});
  const [isGeneratingMap, setIsGeneratingMap] = useState<Record<string, boolean>>({});
  const [modalOpenHolidayId, setModalOpenHolidayId] = useState<string | null>(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (holidays.length > 0) {
      holidays.forEach((holiday) => {
        fetchContentState(holiday.id);
        fetchHolidayTasks(holiday.id);
      });
    }
  }, [holidays]);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });

      if (error) {
        console.error("Error fetching holidays:", error);
        toast.error("Failed to load holidays");
      } else {
        setHolidays(data || []);
      }
    } catch (error) {
      console.error("Exception fetching holidays:", error);
      toast.error("Failed to load holidays");
    }
  };

  const fetchContentState = async (holidayId: string) => {
    try {
      const { data, error } = await supabase
        .from("content_tasks")
        .select("id")
        .eq("holiday_id", holidayId);

      if (error) {
        console.error(`Error fetching content state for holiday ${holidayId}:`, error);
      } else {
        setContentStates((prev) => ({
          ...prev,
          [holidayId]: { contentCount: data ? data.length : 0 },
        }));
      }
    } catch (error) {
      console.error(`Exception fetching content state for holiday ${holidayId}:`, error);
    }
  };

  const fetchHolidayTasks = async (holidayId: string) => {
    try {
      const { data, error } = await supabase
        .from("content_tasks")
        .select("*")
        .eq("holiday_id", holidayId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(`Error fetching tasks for holiday ${holidayId}:`, error);
      } else {
        setHolidayTasksMap((prev) => ({
          ...prev,
          [holidayId]: data || [],
        }));
      }
    } catch (error) {
      console.error(`Exception fetching tasks for holiday ${holidayId}:`, error);
    }
  };

  const handleGenerateContent = async (holidayId: string) => {
    setIsGeneratingMap((prev) => ({ ...prev, [holidayId]: true }));
    try {
      // Call your content generation logic here, e.g., an API call
      // For demo, simulate delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // After generation, refresh content state and tasks
      await fetchContentState(holidayId);
      await fetchHolidayTasks(holidayId);
      toast.success("Content generated successfully");
      
      // Call the onContentGenerated callback if provided
      if (onContentGenerated) {
        onContentGenerated();
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast.error("Failed to generate content");
    } finally {
      setIsGeneratingMap((prev) => ({ ...prev, [holidayId]: false }));
    }
  };

  const handleViewContent = (holidayId: string) => {
    setModalOpenHolidayId(holidayId);
  };

  const handleModalClose = () => {
    setModalOpenHolidayId(null);
  };

  const handleApprove = (postIds: string[]) => {
    console.log("Approved posts:", postIds);
    // Implement approval logic here
    setModalOpenHolidayId(null);
  };

  const handleRegenerate = () => {
    if (modalOpenHolidayId) {
      handleGenerateContent(modalOpenHolidayId);
      setModalOpenHolidayId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal Holiday Opportunities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {holidays.map((holiday, index) => (
          <HolidayItem
            key={holiday.id}
            holiday={holiday}
            onGenerateContent={handleGenerateContent}
            onViewContent={handleViewContent}
            isGenerating={!!isGeneratingMap[holiday.id]}
            contentState={contentStates[holiday.id]}
            isFirst={index === 0}
            holidayTasks={holidayTasksMap[holiday.id] || []}
          />
        ))}
      </CardContent>

      {modalOpenHolidayId && holidayTasksMap[modalOpenHolidayId] && (
        <FivePostModal
          isOpen={!!modalOpenHolidayId}
          onClose={handleModalClose}
          title={
            holidays.find((h) => h.id === modalOpenHolidayId)?.holiday_name || "Holiday Content"
          }
          posts={holidayTasksMap[modalOpenHolidayId]}
          onApprove={handleApprove}
          onRegenerate={handleRegenerate}
        />
      )}
    </Card>
  );
};
