import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  addMonths,
  addWeeks,
  format,
  getISOWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CheckCircle2,
  Clock3,
  Megaphone,
  Play,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CatalogStatsStrip } from "@/components/crm/catalog/CatalogStatsStrip";
import { JoyButton } from "@/components/joy/JoyButton";
import { useAuth } from "@/contexts/AuthContext";
import useMediaQuery from "@/hooks/use-media-query";
import { useToast } from "@/hooks/use-toast";
import { useRouteState } from "@/hooks/useRouteState";
import { useTenant } from "@/hooks/useTenant";
import {
  useUnifiedCalendarData,
  type UnifiedCalendarEvent,
} from "@/hooks/useUnifiedCalendarData";
import { supabase } from "@/integrations/supabase/client";
import { persistCampaignDraft } from "@/lib/crm/campaignEditor";
import { applyTenantUserScope } from "@/utils/tenantScope";
import { CampaignOverviewDialog } from "./calendar/CampaignOverviewDialog";
import { CalendarCampaignCreateDialog } from "./calendar/CalendarCampaignCreateDialog";
import { CalendarEventDialog } from "./calendar/CalendarEventDialog";
import { CalendarGrid } from "./calendar/CalendarGrid";
import { CalendarHolidayContentDialog } from "./calendar/CalendarHolidayContentDialog";
import { DayEventsModal } from "./calendar/DayEventsModal";
import { CalendarNewsletterDialog } from "./calendar/CalendarNewsletterDialog";
import { CalendarNewsletterDrawer } from "./calendar/CalendarNewsletterDrawer";
import { CalendarListView } from "./calendar/CalendarListView";
import { CalendarPlanningPanel } from "./calendar/CalendarPlanningPanel";
import { CalendarTaskDetailsDialog } from "./calendar/CalendarTaskDetailsDialog";
import { QuickAddSheet } from "./calendar/QuickAddSheet";
import { ScheduledPostDetailsDialog } from "./calendar/ScheduledPostDetailsDialog";
import { CalendarToolbar } from "./calendar/CalendarToolbar";
import { CalendarWeeklyThemesDialog } from "./calendar/CalendarWeeklyThemesDialog";

type ViewMode = "month" | "week" | "list";
type QuickAddType = "task" | "event" | "newsletter";

type CalendarOverview = {
  totalCampaigns: number;
  activeCampaigns: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
  activeGenerationJobs: number;
};

export const CalendarView = React.memo(function CalendarView({
  campaignOverview,
  headerSupplement,
  onDataUpdate,
  showWeeklyThemesModal,
  onCloseWeeklyThemesModal,
}: {
  campaignOverview: CalendarOverview;
  headerSupplement?: React.ReactNode;
  onDataUpdate: () => void;
  showWeeklyThemesModal?: boolean;
  onCloseWeeklyThemesModal?: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const isInlinePlanningPanel = !useMediaQuery("(max-width:1199px)");

  const {
    events,
    eventsByDate,
    getEventsForDate,
    filters,
    updateFilters,
    resetFilters,
    filterOptions,
    loading,
    refetch,
    rawData,
    isRefreshing,
    lastUpdated,
    newsletterActions,
    holidayActions,
    scheduledPostActions,
  } = useUnifiedCalendarData();

  const { getState, updateState } = useRouteState(
    {
      selectedTasks: [],
      viewMode: "month",
      currentDate: new Date().toISOString(),
      showPlanningPanel: false,
    },
    { disableScrollTracking: true },
  );

  const savedState = getState();
  const [selectedTasks, setSelectedTasks] = useState<string[]>(
    savedState.selectedTasks || [],
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    savedState.viewMode || "month",
  );
  const [currentDate, setCurrentDate] = useState<Date>(
    savedState.currentDate ? new Date(savedState.currentDate) : new Date(),
  );
  const [showPlanningPanel, setShowPlanningPanel] = useState<boolean>(
    savedState.showPlanningPanel ?? false,
  );
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [quickAddDefaultType, setQuickAddDefaultType] =
    useState<QuickAddType>("task");
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  const [selectedTaskForModal, setSelectedTaskForModal] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);

  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  const [selectedNewsletter, setSelectedNewsletter] = useState<any>(null);
  const [newsletterDrawerOpen, setNewsletterDrawerOpen] = useState(false);
  const [newsletterDialogOpen, setNewsletterDialogOpen] = useState(false);
  const [newsletterMode, setNewsletterMode] = useState<"create" | "edit">(
    "create",
  );
  const [selectedDateForNewsletter, setSelectedDateForNewsletter] =
    useState<Date | null>(null);

  const [selectedScheduledPost, setSelectedScheduledPost] = useState<any>(null);
  const [scheduledPostDialogOpen, setScheduledPostDialogOpen] = useState(false);

  const [selectedDateForEvents, setSelectedDateForEvents] =
    useState<Date | null>(null);
  const [dayEventsModalOpen, setDayEventsModalOpen] = useState(false);

  const [holidayContentViewer, setHolidayContentViewer] = useState<{
    isOpen: boolean;
    holidayId: string | null;
    holidayName: string;
  }>({
    isOpen: false,
    holidayId: null,
    holidayName: "",
  });

  const [themesReferenceModalOpen, setThemesReferenceModalOpen] =
    useState(false);
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [addEventDefaultDate, setAddEventDefaultDate] = useState<Date | null>(
    null,
  );
  const [newCampaignModalOpen, setNewCampaignModalOpen] = useState(false);

  const closePlanningPanel = useCallback(() => {
    setShowPlanningPanel(false);
    updateState("showPlanningPanel", false);
  }, [updateState]);

  const refreshCalendar = useCallback(async () => {
    await refetch();
    onDataUpdate();
  }, [onDataUpdate, refetch]);

  const navigateRange = useCallback(
    (direction: "next" | "previous") => {
      const nextDate =
        viewMode === "month"
          ? direction === "next"
            ? addMonths(currentDate, 1)
            : subMonths(currentDate, 1)
          : direction === "next"
            ? addWeeks(currentDate, 1)
            : subWeeks(currentDate, 1);

      setCurrentDate(nextDate);
      updateState("currentDate", nextDate.toISOString());
    },
    [currentDate, updateState, viewMode],
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    updateState("currentDate", today.toISOString());
  }, [updateState]);

  const handleViewModeChange = useCallback(
    (nextViewMode: ViewMode) => {
      setViewMode(nextViewMode);
      updateState("viewMode", nextViewMode);
    },
    [updateState],
  );

  const togglePlanningPanel = useCallback(() => {
    const nextValue = !showPlanningPanel;
    setShowPlanningPanel(nextValue);
    updateState("showPlanningPanel", nextValue);
  }, [showPlanningPanel, updateState]);

  const toggleTaskSelection = useCallback(
    (taskId: string) => {
      setSelectedTasks((current) => {
        const next = current.includes(taskId)
          ? current.filter((id) => id !== taskId)
          : [...current, taskId];
        updateState("selectedTasks", next);
        return next;
      });
    },
    [updateState],
  );

  const clearSelection = useCallback(() => {
    setSelectedTasks([]);
    updateState("selectedTasks", []);
  }, [updateState]);

  const handleBulkComplete = useCallback(async () => {
    if (selectedTasks.length === 0 || !user) return;

    await Promise.all(
      selectedTasks.map(async (taskId) => {
        let query = supabase
          .from("content_tasks")
          .update({ status: "completed" })
          .eq("id", taskId);

        query = applyTenantUserScope(query, {
          tenantId: tenant?.id,
          userId: user.id,
        });

        const { error } = await query;

        if (error) throw error;
      }),
    );

    clearSelection();
    await refreshCalendar();
  }, [clearSelection, refreshCalendar, selectedTasks, tenant?.id, user]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTasks.length === 0 || !user) return;

    await Promise.all(
      selectedTasks.map(async (taskId) => {
        let query = supabase.from("content_tasks").delete().eq("id", taskId);

        query = applyTenantUserScope(query, {
          tenantId: tenant?.id,
          userId: user.id,
        });

        const { error } = await query;

        if (error) throw error;
      }),
    );

    clearSelection();
    await refreshCalendar();
  }, [clearSelection, refreshCalendar, selectedTasks, tenant?.id, user]);

  const openQuickAdd = useCallback(
    (date: Date, type: QuickAddType = "task") => {
      setQuickAddDate(date);
      setQuickAddDefaultType(type);
      setQuickAddOpen(true);
    },
    [],
  );

  const openEventDialog = useCallback((date?: Date) => {
    setAddEventDefaultDate(date ?? new Date());
    setAddEventDialogOpen(true);
  }, []);

  const openNewsletterDialog = useCallback((date?: Date) => {
    setSelectedDateForNewsletter(date ?? new Date());
    setSelectedNewsletter(null);
    setNewsletterMode("create");
    setNewsletterDialogOpen(true);
  }, []);

  const handleQuickAddSubmit = useCallback(
    async ({
      type,
      title,
      date,
      notes,
    }: {
      type: QuickAddType;
      title: string;
      date: string;
      notes: string;
    }) => {
      if (!user) return;

      setQuickAddLoading(true);
      try {
        if (type === "task") {
          const { error } = await supabase.from("content_tasks").insert({
            post_type: "instagram",
            status: "planned",
            scheduled_date: date,
            ai_output: title,
            notes: notes || null,
            user_id: user.id,
            created_by_user_id: user.id,
            ...(tenant?.id ? { tenant_id: tenant.id } : {}),
          });

          if (error) throw error;
        }

        if (type === "event") {
          const { error } = await supabase.from("campaigns").insert({
            title,
            description: notes || null,
            theme: `${title} Promotion`,
            prompt: notes || `${title} campaign`,
            start_date: date,
            week_number: getISOWeek(new Date(`${date}T12:00:00`)),
            source: "quick_action",
            user_id: user.id,
            created_by_user_id: user.id,
            ...(tenant?.id ? { tenant_id: tenant.id } : {}),
          });

          if (error) throw error;
        }

        if (type === "newsletter") {
          if (!tenant?.id) {
            throw new Error("Newsletter scheduling requires an organization.");
          }

          const scheduledAt = new Date(`${date}T09:00:00`);

          await persistCampaignDraft({
            campaignType: "email",
            status: "scheduled",
            name: title,
            subjectLine: title,
            preheaderText: notes,
            senderName: "",
            senderEmail: "",
            replyTo: "",
            contentBlocks: [],
            smsMessage: "",
            sendAt: scheduledAt,
            sendImmediately: false,
            segments: [],
            personas: [],
          });
        }

        setQuickAddOpen(false);
        await refreshCalendar();
      } catch (error) {
        console.error("Error creating quick add item:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to create item",
          variant: "destructive",
        });
      } finally {
        setQuickAddLoading(false);
      }
    },
    [refreshCalendar, tenant?.id, toast, user],
  );

  const handleHolidayAction = useCallback(
    async (holiday: any, action: "generate" | "review") => {
      if (action === "review") {
        setHolidayContentViewer({
          isOpen: true,
          holidayId: holiday.id,
          holidayName: holiday.holiday_name,
        });
        return;
      }

      await holidayActions.generateHolidayContent(holiday.id);
      await refreshCalendar();
    },
    [holidayActions, refreshCalendar],
  );

  const handleThemeSchedule = useCallback(
    async (theme: any, date: Date) => {
      if (!user) return;

      try {
        const startDate = format(date, "yyyy-MM-dd");
        const { error } = await supabase.from("campaigns").insert({
          title: theme.title,
          theme: theme.theme,
          description: theme.content_ideas,
          prompt: theme.prompt || theme.content_ideas,
          start_date: startDate,
          week_number: theme.week_number || getISOWeek(date),
          source: "quick_action",
          user_id: user.id,
          created_by_user_id: user.id,
          ...(tenant?.id ? { tenant_id: tenant.id } : {}),
        });

        if (error) throw error;
        await refreshCalendar();
      } catch (error) {
        console.error("Error scheduling theme:", error);
      }
    },
    [refreshCalendar, tenant?.id, user],
  );

  const handleEventClick = useCallback((event: UnifiedCalendarEvent) => {
    if (event.type === "task") {
      setSelectedTaskForModal(event.meta);
      setContentModalOpen(true);
      return;
    }

    if (event.type === "event") {
      setSelectedCampaign(event.meta);
      setCampaignModalOpen(true);
      return;
    }

    if (event.type === "newsletter") {
      setSelectedNewsletter(event.meta);
      setNewsletterDrawerOpen(true);
      return;
    }

    if (event.type === "scheduled_post") {
      setSelectedScheduledPost(event.meta);
      setScheduledPostDialogOpen(true);
      return;
    }

    setHolidayContentViewer({
      isOpen: true,
      holidayId: event.meta.id,
      holidayName: event.meta.holiday_name,
    });
  }, []);

  const handleDateClick = useCallback(
    (date: Date) => {
      const dayEvents = getEventsForDate(date);
      if (dayEvents.length === 0) {
        openQuickAdd(date, "task");
        return;
      }

      setSelectedDateForEvents(date);
      setDayEventsModalOpen(true);
    },
    [getEventsForDate, openQuickAdd],
  );

  const handleEditNewsletter = useCallback((newsletter: any) => {
    setSelectedNewsletter(newsletter);
    setSelectedDateForNewsletter(
      newsletter.scheduled_at ? new Date(newsletter.scheduled_at) : new Date(),
    );
    setNewsletterMode("edit");
    setNewsletterDialogOpen(true);
  }, []);

  const handleDuplicateNewsletter = useCallback(
    async (newsletter: any) => {
      await newsletterActions.duplicateNewsletter(newsletter);
      await refreshCalendar();
    },
    [newsletterActions, refreshCalendar],
  );

  const handleDeleteNewsletter = useCallback(
    async (newsletter: any) => {
      await newsletterActions.deleteNewsletter(newsletter.id);
      await refreshCalendar();
    },
    [newsletterActions, refreshCalendar],
  );

  const handleViewNewsletterInCRM = useCallback(
    (newsletter: any) => {
      navigate(`/crm/campaigns/${newsletter.id}`);
    },
    [navigate],
  );

  const handleDeleteSelectedFromModal = useCallback(
    async (taskIds: string[]) => {
      if (!user) return;

      await Promise.all(
        taskIds.map(async (taskId) => {
          let query = supabase.from("content_tasks").delete().eq("id", taskId);

          query = applyTenantUserScope(query, {
            tenantId: tenant?.id,
            userId: user.id,
          });

          const { error } = await query;

          if (error) throw error;
        }),
      );
      await refreshCalendar();
    },
    [refreshCalendar, tenant?.id, user],
  );

  useEffect(() => {
    if (loading) return;

    const createParam = searchParams.get("create");
    const dateParam = searchParams.get("date");
    const campaignParam = searchParams.get("campaign");
    const taskParam = searchParams.get("task");
    const nextParams = new URLSearchParams(searchParams);
    let didChange = false;

    if (createParam === "event") {
      openEventDialog(
        dateParam ? new Date(`${dateParam}T12:00:00`) : new Date(),
      );
      nextParams.delete("create");
      nextParams.delete("date");
      didChange = true;
    }

    if (campaignParam) {
      const event = events.find(
        (item) => item.id === campaignParam && item.type === "event",
      );
      if (event) {
        const targetDate = event.date;
        setCurrentDate(targetDate);
        updateState("currentDate", targetDate.toISOString());
        setHighlightedEventId(campaignParam);
        handleEventClick(event);
      }
      nextParams.delete("campaign");
      didChange = true;
    }

    if (taskParam) {
      const event = events.find((item) => item.id === taskParam);
      if (event) {
        setCurrentDate(event.date);
        updateState("currentDate", event.date.toISOString());
        setHighlightedEventId(taskParam);
        handleEventClick(event);
      }
      nextParams.delete("task");
      didChange = true;
    }

    if (didChange) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    events,
    handleEventClick,
    loading,
    openEventDialog,
    searchParams,
    setSearchParams,
    updateState,
  ]);

  useEffect(() => {
    if (!highlightedEventId) return;

    const timeout = window.setTimeout(() => setHighlightedEventId(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [highlightedEventId]);

  const gridOrList = useMemo(() => {
    if (viewMode === "list") {
      return (
        <CalendarListView
          events={events}
          onEventClick={handleEventClick}
          selectionMode={true}
          selectedTaskIds={selectedTasks}
          onToggleTaskSelection={toggleTaskSelection}
        />
      );
    }

    return (
      <CalendarGrid
        currentDate={currentDate}
        viewMode={viewMode}
        eventsByDate={eventsByDate}
        highlightedEventId={highlightedEventId}
        selectionMode={selectedTasks.length > 0}
        selectedTaskIds={selectedTasks}
        onToggleTaskSelection={toggleTaskSelection}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
        onDateCreate={openQuickAdd}
      />
    );
  }, [
    currentDate,
    events,
    eventsByDate,
    handleDateClick,
    handleEventClick,
    highlightedEventId,
    openQuickAdd,
    selectedTasks,
    toggleTaskSelection,
    viewMode,
  ]);

  const calendarStats = useMemo(
    () => [
      {
        label: "Total Campaigns",
        value: campaignOverview.totalCampaigns.toLocaleString(),
        icon: <Megaphone size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Active",
        value: campaignOverview.activeCampaigns.toLocaleString(),
        icon: <Play size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Scheduled",
        value: campaignOverview.scheduledCampaigns.toLocaleString(),
        icon: <Clock3 size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Completed",
        value: campaignOverview.completedCampaigns.toLocaleString(),
        icon: <CheckCircle2 size={18} />,
        iconColor: "neutral" as const,
      },
    ],
    [campaignOverview],
  );

  const metadataLabel = useMemo(() => {
    const segments = [
      "Marketing planning",
      `${campaignOverview.totalCampaigns.toLocaleString()} campaigns`,
    ];

    if (campaignOverview.activeGenerationJobs > 0) {
      segments.push(
        `${campaignOverview.activeGenerationJobs.toLocaleString()} generating now`,
      );
    }

    return segments.join(" · ");
  }, [campaignOverview]);

  return (
    <Stack spacing={3} sx={{ minWidth: 0, width: "100%" }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="h3" fontWeight="bold">
              Campaign Calendar
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Plan campaigns, content tasks, newsletters, and seasonal moments
              from one organized planning surface.
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500", mt: 0.5 }}>
              {metadataLabel}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => {
                void refreshCalendar();
              }}
              aria-label="Refresh calendar"
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  animation: isRefreshing
                    ? "calendar-refresh-spin 1s linear infinite"
                    : "none",
                  "@keyframes calendar-refresh-spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCcw size={16} />
              </Box>
            </IconButton>

            <Dropdown>
              <MenuButton
                slots={{ root: JoyButton }}
                slotProps={{
                  root: {
                    variant: "solid",
                    color: "primary",
                    size: "sm",
                    startDecorator: <Plus size={16} />,
                  },
                }}
              >
                Create
              </MenuButton>
              <Menu placement="bottom-end" sx={{ minWidth: 220, p: 0.5 }}>
                <MenuItem onClick={() => openQuickAdd(currentDate, "task")}>
                  New Task
                </MenuItem>
                <MenuItem onClick={() => openEventDialog(currentDate)}>
                  New Event
                </MenuItem>
                <MenuItem onClick={() => setNewCampaignModalOpen(true)}>
                  New Campaign
                </MenuItem>
                <MenuItem onClick={() => openNewsletterDialog(currentDate)}>
                  New Newsletter
                </MenuItem>
              </Menu>
            </Dropdown>
          </Stack>
        </Stack>

        <CatalogStatsStrip items={calendarStats} />
      </Stack>

      <CalendarToolbar
        currentDate={currentDate}
        viewMode={viewMode}
        filters={filters}
        filterOptions={filterOptions}
        selectionCount={selectedTasks.length}
        showPlanningPanel={showPlanningPanel}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onPrevious={() => navigateRange("previous")}
        onNext={() => navigateRange("next")}
        onToday={goToToday}
        onViewModeChange={handleViewModeChange}
        onFiltersChange={updateFilters}
        onResetFilters={resetFilters}
        onTogglePlanningPanel={togglePlanningPanel}
        onBulkComplete={() => {
          void handleBulkComplete();
        }}
        onBulkDelete={() => {
          void handleBulkDelete();
        }}
      />

      {isRefreshing ? (
        <LinearProgress thickness={2} sx={{ borderRadius: 999 }} />
      ) : null}

      {headerSupplement}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns:
            showPlanningPanel && isInlinePlanningPanel
              ? "minmax(0, 1fr) 340px"
              : "1fr",
          gap: 2,
          alignItems: "start",
          minWidth: 0,
          width: "100%",
        }}
      >
        <Stack
          spacing={2}
          sx={{ minWidth: 0, width: "100%", maxWidth: "100%" }}
        >
          {gridOrList}
        </Stack>
        {showPlanningPanel && isInlinePlanningPanel ? (
          <CalendarPlanningPanel
            open={showPlanningPanel}
            inline
            currentDate={currentDate}
            campaigns={rawData.campaigns}
            holidays={rawData.holidays}
            holidayContentState={holidayActions.holidayContentState}
            onThemeSchedule={handleThemeSchedule}
            onHolidayAction={handleHolidayAction}
            onOpenThemesReference={() => setThemesReferenceModalOpen(true)}
            onClose={closePlanningPanel}
          />
        ) : null}
      </Box>

      {!isInlinePlanningPanel ? (
        <CalendarPlanningPanel
          open={showPlanningPanel}
          currentDate={currentDate}
          campaigns={rawData.campaigns}
          holidays={rawData.holidays}
          holidayContentState={holidayActions.holidayContentState}
          onThemeSchedule={handleThemeSchedule}
          onHolidayAction={handleHolidayAction}
          onOpenThemesReference={() => setThemesReferenceModalOpen(true)}
          onClose={closePlanningPanel}
        />
      ) : null}

      <QuickAddSheet
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        selectedDate={quickAddDate}
        defaultType={quickAddDefaultType}
        loading={quickAddLoading}
        onSubmit={handleQuickAddSubmit}
      />

      <CalendarNewsletterDialog
        isOpen={newsletterDialogOpen}
        onClose={() => {
          setNewsletterDialogOpen(false);
          setSelectedNewsletter(null);
          setSelectedDateForNewsletter(null);
        }}
        onSuccess={() => {
          void refreshCalendar();
        }}
        selectedDate={selectedDateForNewsletter}
        existingNewsletter={
          newsletterMode === "edit" ? selectedNewsletter : undefined
        }
        mode={newsletterMode}
      />

      <CalendarNewsletterDrawer
        newsletter={selectedNewsletter}
        isOpen={newsletterDrawerOpen}
        onClose={() => {
          setNewsletterDrawerOpen(false);
          setSelectedNewsletter(null);
        }}
        onEdit={handleEditNewsletter}
        onDuplicate={(newsletter) => {
          void handleDuplicateNewsletter(newsletter);
        }}
        onDelete={(newsletter) => {
          void handleDeleteNewsletter(newsletter);
        }}
        onViewInCRM={handleViewNewsletterInCRM}
      />

      <ScheduledPostDetailsDialog
        post={selectedScheduledPost}
        open={scheduledPostDialogOpen}
        onClose={() => {
          setScheduledPostDialogOpen(false);
          setSelectedScheduledPost(null);
        }}
        onViewContent={(task) => {
          setSelectedTaskForModal(task);
          setContentModalOpen(true);
        }}
      />

      {selectedTaskForModal ? (
        <CalendarTaskDetailsDialog
          task={selectedTaskForModal}
          isOpen={contentModalOpen}
          onClose={() => {
            setContentModalOpen(false);
            setSelectedTaskForModal(null);
          }}
        />
      ) : null}

      {selectedCampaign ? (
        <CampaignOverviewDialog
          campaign={selectedCampaign}
          isOpen={campaignModalOpen}
          onClose={() => {
            setCampaignModalOpen(false);
            setSelectedCampaign(null);
          }}
          onOpenCampaign={() => navigate("/campaigns")}
        />
      ) : null}

      <DayEventsModal
        isOpen={dayEventsModalOpen}
        onClose={() => {
          setDayEventsModalOpen(false);
          setSelectedDateForEvents(null);
        }}
        date={selectedDateForEvents}
        events={events}
        onEventClick={handleEventClick}
        onDeleteSelected={handleDeleteSelectedFromModal}
      />

      <CalendarEventDialog
        open={addEventDialogOpen}
        onOpenChange={setAddEventDialogOpen}
        onEventCreated={() => {
          void refreshCalendar();
        }}
        defaultDate={addEventDefaultDate}
      />

      <CalendarCampaignCreateDialog
        open={newCampaignModalOpen}
        onOpenChange={setNewCampaignModalOpen}
        onCampaignCreated={() => {
          void refreshCalendar();
        }}
      />

      <CalendarWeeklyThemesDialog
        open={showWeeklyThemesModal || themesReferenceModalOpen}
        onClose={() => {
          if (showWeeklyThemesModal && onCloseWeeklyThemesModal) {
            onCloseWeeklyThemesModal();
            return;
          }
          setThemesReferenceModalOpen(false);
        }}
        onRefresh={() => {
          void refreshCalendar();
        }}
        onScheduleTheme={(theme, date) => {
          void handleThemeSchedule(theme, date);
        }}
      />

      <CalendarHolidayContentDialog
        holidayId={holidayContentViewer.holidayId || ""}
        holidayName={holidayContentViewer.holidayName}
        isOpen={holidayContentViewer.isOpen}
        onClose={() =>
          setHolidayContentViewer({
            isOpen: false,
            holidayId: null,
            holidayName: "",
          })
        }
        onGenerate={() => {
          const holiday = rawData.holidays.find(
            (item) => item.id === holidayContentViewer.holidayId,
          );
          if (holiday) {
            void handleHolidayAction(holiday, "generate");
          }
        }}
      />
    </Stack>
  );
});
