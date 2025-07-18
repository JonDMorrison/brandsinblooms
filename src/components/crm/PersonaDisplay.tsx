import { PersonaTag } from "./PersonaTag";
import { Lightbulb } from "lucide-react";

interface PersonaDisplayProps {
  personas: any[];
  className?: string;
  showLabel?: boolean;
}

export const PersonaDisplay = ({ 
  personas, 
  className = "",
  showLabel = true
}: PersonaDisplayProps) => {
  if (!personas || personas.length === 0) {
    return null;
  }

  const formatPersonaText = (personas: any[]): string => {
    const names = personas.map(p => p.persona_name || p.name);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} + ${names[1]}`;
    const allButLast = names.slice(0, -1).join(", ");
    return `${allButLast} + ${names[names.length - 1]}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Lightbulb className="h-4 w-4 text-purple-500" />
          <span>Crafted for:</span>
        </div>
      )}
      
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-purple-700">
          {formatPersonaText(personas)}
        </span>
        
        {/* Individual persona tags on hover/expand */}
        <div className="hidden lg:flex gap-1 ml-2">
          {personas.slice(0, 3).map((persona) => (
            <PersonaTag
              key={persona.id}
              persona={persona}
              size="sm"
            />
          ))}
          {personas.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{personas.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};