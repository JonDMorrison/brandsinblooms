import { useState, useMemo, useCallback } from "react";
import { useGlobalCalendarData } from "@/hooks/useGlobalCalendarData";
import { useScheduledPosts } from "@/hooks/useScheduledPosts";
import { useNewsletterCalendar } from "@/hooks/useNewsletterCalendar";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { useRouteState } from "@/hooks/useRouteState";
import { format } from "date-fns";
import { sortCalendarEvents } from "@/components/calendar/calendarEventPresentation";

export interface UnifiedCalendarEvent {
  id: string;
  type: "task" | "scheduled_post" | "newsletter" | "event" | "holiday";
  title: string;
  date: Date;
  time?: string;
  status?: string;
  platform?: string;
  campaign_id?: string;
  meta?: any;
}

export interface CalendarFilters {
  types: string[];
  platforms: string[];
  statuses: string[];
  showPublished: boolean;
  searchQuery: string;
}

const DEFAULT_FILTERS: CalendarFilters = {
  types: ["task", "scheduled_post", "newsletter", "event", "holiday"],
  platforms: [],
  statuses: [],
  showPublished: true,
  searchQuery: "",
};

export const useUnifiedCalendarData = () => {
  const {
    campaigns,
    tasks,
    loading: globalLoading,
    refetch: refetchGlobal,
    isRefreshing,
    lastUpdated,
  } = useGlobalCalendarData();
  const {
    scheduledPosts,
    loading: postsLoading,
    schedulePost,
    reschedulePost,
    unschedulePost,
    deleteScheduledPost,
    refreshScheduledPosts,
  } = useScheduledPosts();
  const {
    newsletters,
    loading: newslettersLoading,
    error: newslettersError,
    loadNewsletters,
    createNewsletter,
    updateNewsletter,
    deleteNewsletter,
    duplicateNewsletter,
  } = useNewsletterCalendar();
  const {
    allHolidays,
    holidayContentState,
    loading: holidaysLoading,
    error: holidaysError,
    generateHolidayContent,
    refreshHolidayContent,
    refetch: refetchHolidays,
  } = useSeasonalHolidays();

  const { getState, updateState } = useRouteState(
    {
      filters: DEFAULT_FILTERS,
      viewMode: "month",
      currentDate: new Date().toISOString(),
    },
    { disableScrollTracking: true },
  );

  const savedState = getState();
  const [filters, setFilters] = useState<CalendarFilters>(
    savedState.filters || DEFAULT_FILTERS,
  );

  const unifiedEvents = useMemo(() => {
    const events: UnifiedCalendarEvent[] = [];

    tasks.forEach((task) => {
      if (task.scheduled_date) {
        events.push({
          id: task.id,
          type: "task",
          title: task.ai_output
            ? task.ai_output.substring(0, 50) + "..."
            : "Content task",
          date: new Date(task.scheduled_date),
          status: task.status,
          platform: (task as any).post_type,
          campaign_id: task.campaign_id,
          meta: task,
        });
      }
    });

    scheduledPosts.forEach((post) => {
      if (post.publish_at) {
        const publishDate = new Date(post.publish_at);
        events.push({
          id: post.id,
          type: "scheduled_post",
          title: post.content?.caption
            ? post.content.caption.substring(0, 50) + "..."
            : `${post.platform} post`,
          date: publishDate,
          time: format(publishDate, "h:mm a"),
          status: post.status,
          platform: post.platform,
          meta: post,
        });
      }
    });

    newsletters.forEach((newsletter) => {
      if (newsletter.scheduled_at) {
        events.push({
          id: newsletter.id,
          type: "newsletter",
          title: newsletter.subject_line || newsletter.name,
          date: new Date(newsletter.scheduled_at),
          status: newsletter.status,
          meta: newsletter,
        });
      }
    });

    campaigns.forEach((campaign) => {
      if (campaign.start_date) {
        events.push({
          id: campaign.id,
          type: "event",
          title: campaign.title,
          date: new Date(campaign.start_date),
          campaign_id: campaign.id,
          meta: campaign,
        });
      }
    });

    allHolidays.forEach((holiday) => {
      events.push({
        id: holiday.id,
        type: "holiday",
        title: holiday.holiday_name,
        date: new Date(holiday.holiday_date),
        meta: holiday,
      });
    });

    return events;
  }, [tasks, scheduledPosts, newsletters, campaigns, allHolidays]);

  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter((event) => {
      if (filters.types.length > 0 && !filters.types.includes(event.type)) {
        return false;
      }

      if (
        filters.platforms.length > 0 &&
        event.platform &&
        !filters.platforms.includes(event.platform)
      ) {
        return false;
      }

      if (
        filters.statuses.length > 0 &&
        event.status &&
        !filters.statuses.includes(event.status)
      ) {
        return false;
      }

      if (
        !filters.showPublished &&
        ["PUBLISHED", "published", "sent", "completed"].includes(
          String(event.status ?? ""),
        )
      ) {
        return false;
      }

      const searchHaystack = [
        event.title,
        event.meta?.description,
        event.meta?.theme,
        event.meta?.campaigns?.title,
        event.meta?.crm_segments?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        filters.searchQuery &&
        !searchHaystack.includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [unifiedEvents, filters]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, UnifiedCalendarEvent[]> = {};

    filteredEvents.forEach((event) => {
      const dateKey = format(event.date, "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    Object.keys(grouped).forEach((dateKey) => {
      grouped[dateKey] = sortCalendarEvents(grouped[dateKey]);
    });

    return grouped;
  }, [filteredEvents]);

  const getEventsForDate = useCallback(
    (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      return eventsByDate[dateKey] || [];
    },
    [eventsByDate],
  );

  const getEventsForDateRange = useCallback(
    (startDate: Date, endDate: Date) => {
      const events: UnifiedCalendarEvent[] = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        events.push(...getEventsForDate(current));
        current.setDate(current.getDate() + 1);
      }

      return events;
    },
    [getEventsForDate],
  );

  const updateFilters = useCallback(
    (newFilters: Partial<CalendarFilters>) => {
      const updated = { ...filters, ...newFilters };
      setFilters(updated);
      updateState("filters", updated);
    },
    [filters, updateState],
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    updateState("filters", DEFAULT_FILTERS);
  }, [updateState]);

  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const platforms = new Set<string>();
    const statuses = new Set<string>();

    unifiedEvents.forEach((event) => {
      types.add(event.type);
      if (event.platform) platforms.add(event.platform);
      if (event.status) statuses.add(event.status);
    });

    return {
      types: Array.from(types).sort(),
      platforms: Array.from(platforms).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [unifiedEvents]);

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchGlobal(),
      refreshScheduledPosts(),
      loadNewsletters(),
      refetchHolidays(),
      refreshHolidayContent(),
    ]);
  }, [
    refetchGlobal,
    refreshScheduledPosts,
    loadNewsletters,
    refetchHolidays,
    refreshHolidayContent,
  ]);

  const loading =
    globalLoading || postsLoading || newslettersLoading || holidaysLoading;

  return {
    unifiedEvents,
    events: filteredEvents,
    eventsByDate,
    getEventsForDate,
    getEventsForDateRange,
    filters,
    updateFilters,
    resetFilters,
    filterOptions,
    loading,
    refetch,
    isRefreshing,
    lastUpdated,
    errors: {
      newsletters: newslettersError,
      holidays: holidaysError,
    },
    newsletterActions: {
      createNewsletter,
      updateNewsletter,
      deleteNewsletter,
      duplicateNewsletter,
      refresh: loadNewsletters,
    },
    holidayActions: {
      generateHolidayContent,
      refreshHolidayContent,
      refetchHolidays,
      holidayContentState,
    },
    scheduledPostActions: {
      schedulePost,
      reschedulePost,
      unschedulePost,
      deleteScheduledPost,
      refreshScheduledPosts,
    },
    rawData: {
      campaigns,
      tasks,
      scheduledPosts: scheduledPosts || [],
      newsletters: newsletters || [],
      holidays: allHolidays,
    },
  };
};
