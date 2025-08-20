import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGlobalCalendarData } from '@/hooks/useGlobalCalendarData';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useNewsletterCalendar } from '@/hooks/useNewsletterCalendar';
import { useSeasonalHolidays } from '@/hooks/useSeasonalHolidays';
import { useRouteState } from '@/hooks/useRouteState';
import { format } from 'date-fns';

export interface UnifiedCalendarEvent {
  id: string;
  type: 'task' | 'scheduled_post' | 'newsletter' | 'event' | 'holiday';
  title: string;
  date: Date;
  time?: string;
  status?: string;
  platform?: string;
  campaign_id?: string;
  meta?: any;
}

interface CalendarFilters {
  types: string[];
  platforms: string[];
  statuses: string[];
  showPublished: boolean;
  searchQuery: string;
}

export const useUnifiedCalendarData = () => {
  const { campaigns, tasks, loading: globalLoading, refetch } = useGlobalCalendarData();
  const { scheduledPosts, loading: postsLoading } = useScheduledPosts();
  const { newsletters, loading: newslettersLoading } = useNewsletterCalendar();
  const { allHolidays, loading: holidaysLoading } = useSeasonalHolidays();

  // Route state for persistence
  const { saveState, getState, updateState } = useRouteState({
    filters: {
      types: ['task', 'scheduled_post', 'newsletter', 'event', 'holiday'],
      platforms: [],
      statuses: [],
      showPublished: true,
      searchQuery: ''
    } as CalendarFilters,
    viewMode: 'month',
    currentDate: new Date().toISOString()
  }, { disableScrollTracking: true });

  const savedState = getState();
  const [filters, setFilters] = useState<CalendarFilters>(savedState.filters || {
    types: ['task', 'scheduled_post', 'newsletter', 'event', 'holiday'],
    platforms: [],
    statuses: [],
    showPublished: true,
    searchQuery: ''
  });

  // Normalize all data sources into unified events
  const unifiedEvents = useMemo(() => {
    const events: UnifiedCalendarEvent[] = [];

    // Content tasks
    tasks.forEach(task => {
      if (task.scheduled_date) {
        events.push({
          id: task.id,
          type: 'task',
          title: task.ai_output ? task.ai_output.substring(0, 50) + '...' : `Content task`,
          date: new Date(task.scheduled_date),
          status: task.status,
          platform: undefined, // Tasks don't have a platform field
          campaign_id: task.campaign_id,
          meta: task
        });
      }
    });

    // Scheduled posts
    scheduledPosts.forEach(post => {
      if (post.publish_at) {
        const publishDate = new Date(post.publish_at);
        events.push({
          id: post.id,
          type: 'scheduled_post',
          title: post.content?.caption ? post.content.caption.substring(0, 50) + '...' : `${post.platform} post`,
          date: publishDate,
          time: format(publishDate, 'h:mm a'),
          status: post.status,
          platform: post.platform,
          meta: post
        });
      }
    });

    // Newsletters
    newsletters.forEach(newsletter => {
      if (newsletter.scheduled_at) {
        events.push({
          id: newsletter.id,
          type: 'newsletter',
          title: newsletter.subject_line || newsletter.name,
          date: new Date(newsletter.scheduled_at),
          status: newsletter.status,
          meta: newsletter
        });
      }
    });

    // Events (campaigns with quick_action)
    campaigns.forEach(campaign => {
      if (campaign.start_date) {
        events.push({
          id: campaign.id,
          type: 'event',
          title: campaign.title,
          date: new Date(campaign.start_date),
          campaign_id: campaign.id,
          meta: campaign
        });
      }
    });

    // Holidays
    allHolidays.forEach(holiday => {
      events.push({
        id: holiday.id,
        type: 'holiday',
        title: holiday.holiday_name,
        date: new Date(holiday.holiday_date),
        meta: holiday
      });
    });

    return events;
  }, [tasks, scheduledPosts, newsletters, campaigns, allHolidays]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter(event => {
      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(event.type)) {
        return false;
      }

      // Platform filter
      if (filters.platforms.length > 0 && event.platform && !filters.platforms.includes(event.platform)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && event.status && !filters.statuses.includes(event.status)) {
        return false;
      }

      // Published filter
      if (!filters.showPublished && event.status === 'PUBLISHED') {
        return false;
      }

      // Search query
      if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [unifiedEvents, filters]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, UnifiedCalendarEvent[]> = {};
    
    filteredEvents.forEach(event => {
      const dateKey = format(event.date, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort events within each date
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        // Sort by time if available, then by type priority
        if (a.time && b.time) {
          return a.time.localeCompare(b.time);
        }
        const typePriority = { 'event': 0, 'holiday': 1, 'newsletter': 2, 'scheduled_post': 3, 'task': 4 };
        return (typePriority[a.type] || 5) - (typePriority[b.type] || 5);
      });
    });

    return grouped;
  }, [filteredEvents]);

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || [];
  }, [eventsByDate]);

  // Get events for a date range
  const getEventsForDateRange = useCallback((startDate: Date, endDate: Date) => {
    const events: UnifiedCalendarEvent[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      events.push(...getEventsForDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return events;
  }, [getEventsForDate]);

  // Update filters with persistence
  const updateFilters = useCallback((newFilters: Partial<CalendarFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    updateState('filters', updated);
  }, [filters, updateState]);

  // Get available filter options
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const platforms = new Set<string>();
    const statuses = new Set<string>();

    unifiedEvents.forEach(event => {
      types.add(event.type);
      if (event.platform) platforms.add(event.platform);
      if (event.status) statuses.add(event.status);
    });

    return {
      types: Array.from(types),
      platforms: Array.from(platforms),
      statuses: Array.from(statuses)
    };
  }, [unifiedEvents]);

  const loading = globalLoading || postsLoading || newslettersLoading || holidaysLoading;

  return {
    events: filteredEvents,
    eventsByDate,
    getEventsForDate,
    getEventsForDateRange,
    filters,
    updateFilters,
    filterOptions,
    loading,
    refetch,
    // Individual data sources for specific needs
    rawData: {
      campaigns,
      tasks,
      scheduledPosts,
      newsletters,
      holidays: allHolidays
    }
  };
};