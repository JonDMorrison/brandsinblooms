
import React from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { TodayFocusCard } from '@/components/dashboard-social/TodayFocusCard';
import { DraftTray } from '@/components/dashboard-social/DraftTray';
import { ComposerPanel } from '@/components/dashboard-social/ComposerPanel';
import { SmartTimeRibbon } from '@/components/dashboard-social/SmartTimeRibbon';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useDashboard } from '@/contexts/DashboardContext';

const DashboardSocialContent = () => {
  const { scheduleDraft } = useDashboard();

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Handle drag from draft tray to calendar
    if (
      source.droppableId === 'draft-tray' &&
      destination.droppableId.startsWith('calendar-day-')
    ) {
      const dateStr = destination.droppableId.replace('calendar-day-', '');
      await scheduleDraft(draggableId, dateStr);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-[#F9FAFB] p-6">
        <div className="max-w-[1180px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">Social Dashboard</h1>
            <p className="text-gray-600">Your daily content creation rhythm</p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Today's Focus - Columns 1-3 */}
            <div className="col-span-3">
              <TodayFocusCard />
            </div>

            {/* Draft Tray - Columns 4-6 */}
            <div className="col-span-3">
              <DraftTray />
            </div>

            {/* Composer Panel - Columns 7-12 */}
            <div className="col-span-6">
              <ComposerPanel />
            </div>
          </div>

          {/* Smart-Time Ribbon - Full Width */}
          <SmartTimeRibbon />
        </div>
      </div>
    </DragDropContext>
  );
};

const DashboardSocial = () => {
  return (
    <SidebarLayout>
      <DashboardProvider>
        <DashboardSocialContent />
      </DashboardProvider>
    </SidebarLayout>
  );
};

export default DashboardSocial;
