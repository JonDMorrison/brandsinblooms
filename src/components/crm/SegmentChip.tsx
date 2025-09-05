
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Users, Sparkles } from "lucide-react";

interface SegmentChipProps {
  segment: {
    id: string;
    name: string;
    description?: string;
    suggested?: boolean;
    customer_count?: number;
  };
  onRemove?: (segmentId: string) => void;
  removable?: boolean;
  size?: "sm" | "md";
}

export const SegmentChip = ({ 
  segment, 
  onRemove, 
  removable = false,
  size = "md"
}: SegmentChipProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5"
  };

  return (
    <Badge 
      variant="outline" 
      className={`inline-flex items-center gap-1.5 bg-white border-gray-300 text-black hover:bg-gray-50 ${sizeClasses[size]}`}
    >
      <Users className="h-3 w-3" />
      <span className="font-medium">{segment.name}</span>
      
      {segment.suggested && (
        <Sparkles className="h-3 w-3 text-black" />
      )}
      
      {segment.customer_count !== undefined && (
        <span className="text-xs opacity-75">
          ({segment.customer_count})
        </span>
      )}
      
      {removable && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(segment.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  );
};
