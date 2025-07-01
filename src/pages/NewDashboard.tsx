
import React, { useState, useCallback } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useDashboardContext } from '@/context/DashboardContext';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { TodaysFocusCard } from '@/components/new-dashboard/TodaysFocusCard';
import { SmartTimeDock } from '@/components/smart-time/SmartTimeDock';
import { ConnectionAlert } from '@/components/common/ConnectionAlert';
import { DashboardErrorBoundary } from '@/components/dashboard/DashboardErrorBoundary';
import { scheduleDraft } from '@/lib/dashboardAPI';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function NewDashboard() {
  const { 
    data, 
    loading, 
    error, 
    refetch,
    drafts,
    activeDraft,
    setActiveDraft
  } = useDashboardContext();
  
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [justApproved, setJustApproved] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleDragEnd = useCallback(async (result: any) => {
    console.log('🎯 NewDashboard handleDragEnd:', result);
    
    if (!result.destination) {
      console.log('🎯 No destination - drag cancelled');
      return;
    }

    const { draggableId, destination } = result;
    
    // Check if landed in dock (Smart Time Ribbon)
    const landedInDock = destination.droppableId?.startsWith('dock-day-');
    
    if (landedInDock) {
      console.log('🎯 Landed in dock, handling scheduling');
      
      // Extract task ID and date
      const taskId = draggableId.replace('task-', '');
      const dateMatch = destination.droppableId.match(/dock-day-(.+)/);
      
      if (!dateMatch) {
        console.error('❌ Could not parse date from droppable ID');
        return;
      }
      
      const targetDate = dateMatch[1];
      const publishAt = new Date(`${targetDate}T14:00:00`).toISOString();
      
      try {
        const result = await scheduleDraft({
          taskId,
          publishAt,
          platform: 'FACEBOOK'
        });
        
        if (result) {
          toast.success('Content scheduled successfully!');
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
          refetch();
        }
      } catch (error) {
        console.error('❌ Failed to schedule:', error);
        toast.error('Failed to schedule content');
      }
    }
  }, [queryClient, refetch]);

  const handleTaskUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleApproved = useCallback((draftId: string) => {
    setJustApproved(draftId);
    setTimeout(() => setJustApproved(null), 5000);
    refetch();
  }, [refetch]);

  const handleFocusComplete = useCallback(() => {
    console.log('Focus card completed');
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#68BEB9]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#3E5A6B] mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">Failed to load dashboard data</p>
          <button 
            onClick={() => refetch()} 
            className="px-4 py-2 bg-[#68BEB9] text-white rounded-lg hover:bg-[#68BEB9]/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const hasNoConnections = !data?.socialConnections || data.socialConnections.length === 0;

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-[#F9FAFB] pb-80">
        <ConnectionAlert show={hasNoConnections} />
        
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-12 gap-6 min-h-0">
            {/* Left Column - Today's Focus */}
            <div className="col-span-12 lg:col-span-3 min-h-0">
              <TodaysFocusCard 
                campaign={data?.currentCampaign}
                onComplete={handleFocusComplete}
              />
            </div>

            {/* Middle Column - Draft Tray */}
            <div className="col-span-12 lg:col-span-4 min-h-0">
              <DraftTray 
                tasks={drafts || []}
                selectedDraft={selectedDraft}
                onSelectDraft={setSelectedDraft}
                justApprovedId={justApproved}
              />
            </div>

            {/* Right Column - Composer */}
            <div className="col-span-12 lg:col-span-5 min-h-0">
              <ComposerPanel 
                selectedDraft={selectedDraft}
                socialConnections={data?.socialConnections || []}
                onTaskUpdate={handleTaskUpdate}
                onApproved={handleApproved}
              />
            </div>
          </div>
        </div>

        <SmartTimeDock 
          scheduledByDate={data?.scheduledByDate || {}}
          socialConnections={data?.socialConnections || []}
          onScheduleUpdate={refetch}
        />
      </div>
    </DashboardErrorBoundary>
  );
}
