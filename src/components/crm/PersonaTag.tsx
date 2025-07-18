import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PersonaTagProps {
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
  };
  onRemove?: (personaId: string) => void;
  removable?: boolean;
  size?: "sm" | "md";
}

const PERSONA_EMOJIS: Record<string, string> = {
  "Plant-Killer Pam": "🥀",
  "Pet-Friendly Hannah": "🐶", 
  "Vegetable Garden Veronica": "🥕",
  "Sustainable Susie": "♻️",
  "Patio Gardener Gail": "🪴",
  "Pollinator Paula": "🦋",
  "Curb Appeal Ashley": "🏡",
  "DIY Dana": "🔨",
  "Wellness Whitney": "🧘‍♀️"
};

export const PersonaTag = ({ 
  persona, 
  onRemove, 
  removable = false,
  size = "md"
}: PersonaTagProps) => {
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5"
  };

  const emoji = PERSONA_EMOJIS[persona.persona_name] || (persona.is_custom ? "👤" : "🌿");

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