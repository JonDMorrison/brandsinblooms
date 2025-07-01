
import React from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { DashboardProvider, useDashboardContext } from '@/contexts/DashboardContext';
import { ProtectedPageWrapper } from '@/components/ProtectedPageWrapper';
import { FocusCarousel } from '@/components/focus/FocusCarousel';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { SmartTimeDock } from '@/components/smart-time/SmartTimeDock';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';

const NewDashboardContent = () => {
  const { data, refetch } = useDashboardContext();

  const handleDragEnd = async (result: DropResult) => {
    console.log('🎯 Dashboard drag ended:', result);
    // The SmartTimeDock component handles the actual scheduling logic
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-[#F9FAFB] p-6 pb-96">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">Social Dashboard</h1>
            <p className="text-gray-600">Your daily content creation rhythm</p>
          </div>

          {/* Main Grid - Now with more space */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Today's Focus - Columns 1-3 */}
            <div className="col-span-3">
              <FocusCarousel 
                onTaskUpdate={refetch}
              />
            </div>

            {/* Draft Tray - Columns 4-6 */}
            <div className="col-span-3">
              <DraftTray 
                tasks={data?.drafts || []}
                onDragEnd={handleDragEnd}
              />
            </div>

            {/* Composer Panel - Columns 7-12 */}
            <div className="col-span-6">
              <ComposerPanel 
                selectedDraft={data?.selectedDraft}
                socialConnections={data?.socialConnections || []}
                onTaskUpdate={refetch}
              />
            </div>
          </div>

          {/* Smart-Time Dock */}
          <SmartTimeDock
            scheduledByDate={data?.scheduledByDate || {}}
            socialConnections={data?.socialConnections || []}
            onScheduleUpdate={refetch}
          />
        </div>
      </div>
    </DragDropContext>
  );
};

const NewDashboard = () => {
  return (
    <ProtectedPageWrapper>
      <FullWidthLayout>
        <DashboardProvider>
          <NewDashboardContent />
        </DashboardProvider>
      </FullWidthLayout>
    </ProtectedPageWrapper>
  );
};

export default NewDashboard;
