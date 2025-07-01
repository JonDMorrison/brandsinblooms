
import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DraftTrayItem } from './DraftTrayItem';
import { DraftTrayEmpty } from './DraftTrayEmpty';

interface DraftTrayProps {
  tasks: any[];
  selectedDraft: any;
  onSelectDraft: (draft: any) => void;
  justApprovedId?: string | null;
}

export const DraftTray = ({ 
  tasks, 
  selectedDraft, 
  onSelectDraft, 
  justApprovedId
}: DraftTrayProps) => {
  return (
    <Card className="h-full bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Content Drafts</h2>
          <Badge variant="secondary" className="bg-white/60">
            {tasks.length}
          </Badge>
        </div>

        <Droppable droppableId="draft-tray">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex-1 space-y-3 overflow-y-auto",
                snapshot.isDraggingOver && "bg-[#68BEB9]/10 rounded-lg"
              )}
            >
              {tasks.length === 0 ? (
                <DraftTrayEmpty />
              ) : (
                tasks.map((task, index) => (
                  <DraftTrayItem
                    key={task.id}
                    task={task}
                    index={index}
                    isSelected={selectedDraft?.id === task.id}
                    isJustApproved={justApprovedId === task.id}
                    onSelectDraft={onSelectDraft}
                  />
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-white/60 rounded-lg border border-white/40">
          <p className="text-xs text-[#3E5A6B] text-center">
            <span className="font-medium">Drag approved drafts</span> to the Smart-Time dock to schedule them
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
