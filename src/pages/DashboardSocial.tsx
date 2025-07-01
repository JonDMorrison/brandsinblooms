
import React from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { DashboardProvider, useDashboardContext } from '@/contexts/DashboardContext';
import { TodaysFocusCard } from '@/components/new-dashboard/TodaysFocusCard';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { TimePopoverModal } from '@/components/smart-time/TimePopoverModal';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';

const DashboardSocialContent = () => {
  const { data, refetch, stopDragging, timePopoverTask, setTimePopoverTask } = useDashboardContext();

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    console.log('🎯 Dashboard drag ended:', result);

    // Nothing actually moved – ignore
    if (!destination) return;

    const droppedInDock = destination.droppableId.startsWith('day-');

    // Only close the dock after a *successful* dock-drop,
    // and give the UI time to render the new pill first.
    if (droppedInDock) {
      setTimeout(stopDragging, 400);   // tweak as required
    } else {
      stopDragging();                  // re-order in draft tray
    }
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
              <TodaysFocusCard 
                campaign={data?.currentCampaign}
                onComplete={() => {}}
              />
            </div>

            {/* Draft Tray - Columns 4-6 */}
            <div className="col-span-3">
              <DraftTray 
                tasks={data?.drafts || []}
              />
            </div>

            {/* Composer Panel - Columns 7-12 */}
            <div className="col-span-6">
              <ComposerPanel />
            </div>
          </div>

          {/* Time Popover Modal */}
          <TimePopoverModal
            task={timePopoverTask}
            isOpen={!!timePopoverTask}
            onClose={() => setTimePopoverTask(null)}
            onScheduled={refetch}
          />
        </div>
      </div>
    </DragDropContext>
  );
};

const DashboardSocial = () => {
  return (
    <FullWidthLayout>
      <DashboardProvider>
        <DashboardSocialContent />
      </DashboardProvider>
    </FullWidthLayout>
  );
};

export default DashboardSocial;
