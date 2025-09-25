import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedCode: string;
  title?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  open,
  onOpenChange,
  embedCode,
  title = "Video"
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 bg-background border-border">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-foreground">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          <div 
            className="relative w-full bg-muted rounded-lg overflow-hidden"
            style={{ paddingBottom: "56.25%", height: 0 }}
            dangerouslySetInnerHTML={{ __html: embedCode }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};