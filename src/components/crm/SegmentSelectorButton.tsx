
import { Button } from "@/components/ui/button";
import { Users, Plus, ChevronDown } from "lucide-react";
import { SegmentChip } from "./SegmentChip";

interface SegmentSelectorButtonProps {
  selectedSegments: any[];
  onOpenModal: () => void;
  onRemoveSegment?: (segmentId: string) => void;
  placeholder?: string;
  variant?: "default" | "outline";
  className?: string;
}

export const SegmentSelectorButton = ({
  selectedSegments,
  onOpenModal,
  onRemoveSegment,
  placeholder = "Select target segments",
  variant = "outline",
  className = ""
}: SegmentSelectorButtonProps) => {
  const hasSegments = selectedSegments.length > 0;

  if (hasSegments) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Target Segments</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenModal}
            className="text-brand-teal hover:text-brand-teal/80"
          >
            Edit Selection
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedSegments.map((segment) => (
            <SegmentChip
              key={segment.id}
              segment={segment}
              onRemove={onRemoveSegment}
              removable={!!onRemoveSegment}
              size="sm"
            />
          ))}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenModal}
          className="w-full border-dashed border-brand-teal/30 text-brand-teal hover:bg-brand-teal/5"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add More Segments
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={onOpenModal}
      className={`w-full justify-between ${variant === 'outline' ? 'border-dashed border-2 hover:border-brand-teal hover:bg-brand-teal/5' : ''} ${className}`}
    >
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span>{placeholder}</span>
      </div>
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
};
