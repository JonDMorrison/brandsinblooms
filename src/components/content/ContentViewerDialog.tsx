
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentViewerContent } from "./ContentViewerContent";

interface ContentViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaignTitle: string;
  loading: boolean;
  tasks: any[];
  onTaskUpdate?: () => void;
}

export const ContentViewerDialog = ({ 
  isOpen, 
  onClose, 
  campaignTitle, 
  loading, 
  tasks, 
  onTaskUpdate 
}: ContentViewerDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {campaignTitle} - Generated Content
          </DialogTitle>
        </DialogHeader>

        <ContentViewerContent 
          loading={loading}
          tasks={tasks}
          onTaskUpdate={onTaskUpdate}
        />
      </DialogContent>
    </Dialog>
  );
};
