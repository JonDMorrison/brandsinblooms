
import { Badge } from "@/components/ui/badge";

interface DevPreviewBadgeProps {
  show?: boolean;
  size?: "sm" | "default";
}

export const DevPreviewBadge = ({ show = false, size = "default" }: DevPreviewBadgeProps) => {
  if (!show) return null;
  
  return (
    <Badge 
      variant="outline" 
      className={`
        border-2 border-dashed border-blue-400 bg-blue-50 text-blue-700 font-bold
        ${size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1"}
      `}
    >
      🔧 DEV PREVIEW
    </Badge>
  );
};
