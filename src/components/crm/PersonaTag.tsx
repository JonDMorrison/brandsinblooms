import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { X } from "lucide-react";
import { getPersonaEmoji } from "@/config/systemPersonas";

interface PersonaTagProps {
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
    metadata?: unknown;
  };
  onRemove?: (personaId: string) => void;
  removable?: boolean;
  size?: "sm" | "md";
}

export const PersonaTag = ({
  persona,
  onRemove,
  removable = false,
  size = "md",
}: PersonaTagProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
  };

  const emoji = getPersonaEmoji(persona as any);

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 rounded-xl ${sizeClasses[size]}`}
    >
      <span>{emoji}</span>
      <span className="font-medium">{persona.persona_name}</span>

      {persona.is_custom && (
        <span className="text-xs opacity-75">(Custom)</span>
      )}

      {removable && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(persona.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  );
};
