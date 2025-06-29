
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Grid, List } from 'lucide-react';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { DraftCard } from './DraftCard';

interface DraftTrayProps {
  tasks?: any[];
  selectedDraft?: any;
  onSelectDraft?: (draft: any) => void;
  justApprovedId?: string | null;
}

export const DraftTray = ({ tasks = [], selectedDraft, onSelectDraft, justApprovedId }: DraftTrayProps) => {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [showDragHint, setShowDragHint] = useState<string | null>(null);

  useEffect(() => {
    if (justApprovedId) {
      setShowDragHint(justApprovedId);
      const timer = setTimeout(() => {
        setShowDragHint(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [justApprovedId]);

  // Sort and filter tasks
  const sortedTasks = useMemo(() => {
    return [...tasks]
      .filter(task => 
        task.status === 'approved' || task.status === 'generated' || task.status === 'draft'
      )
      .sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (b.status === 'approved' && a.status !== 'approved') return 1;
        return 0;
      });
  }, [tasks]);

  const isDraggable = (draft: any) => {
    return draft.status === 'approved';
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#3E5A6B]">Draft Tray</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
              className="h-7 w-7 p-0"
            >
              {density === 'compact' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {sortedTasks.length} draft{sortedTasks.length !== 1 ? 's' : ''} ready to edit
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
        <Droppable droppableId="draft-tray">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "h-full overflow-y-auto px-4 pb-4",
                snapshot.isDraggingOver && "bg-[#68BEB9]/5 rounded-lg"
              )}
            >
              {sortedTasks.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center py-8">
                  <div>
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No drafts ready</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Generate content to see drafts here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTasks.map((draft, index) => {
                    const canDrag = isDraggable(draft);
                    const showHint = showDragHint === draft.id;
                    
                    return (
                      <Draggable
                        key={draft.id}
                        draggableId={draft.id}
                        index={index}
                        isDragDisabled={!canDrag}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="relative"
                          >
                            <DraftCard
                              task={draft}
                              onSelect={() => onSelectDraft?.(draft)}
                              isSelected={selectedDraft?.id === draft.id}
                              isDraggable={canDrag}
                            />

                            {/* Drag Hint Overlay */}
                            {showHint && (
                              <div className="absolute inset-0 bg-[#68BEB9]/90 rounded-lg flex items-center justify-center text-white font-medium text-sm animate-in fade-in-0 slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                  <span>Ready to schedule – drag me</span>
                                  <span>→</span>
                                </div>
                              </div>
                            )}

                            {/* Drag indicator for approved items */}
                            {snapshot.isDragging && (
                              <div className="absolute -top-2 -right-2 bg-[#68BEB9] text-white text-xs px-2 py-1 rounded-full">
                                Scheduling...
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
};
