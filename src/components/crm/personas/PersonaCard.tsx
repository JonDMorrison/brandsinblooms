import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PersonaCardProps {
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
    created_at: string;
  };
}

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona }) => {
  const isMobile = useIsMobile();

  return (
    <Card className="h-full mobile-hover-lift mobile-card">
      <CardHeader className={`${isMobile ? 'p-4 pb-2' : 'pb-3'} flex flex-row items-start justify-between space-y-0`}>
        <div className="flex-1 min-w-0">
          <CardTitle className={`${isMobile ? 'mobile-text-subheading' : 'text-base'} mb-1 mobile-prevent-overflow`}>
            {persona.persona_name}
          </CardTitle>
          <Badge variant={persona.is_custom ? "default" : "secondary"} className="text-xs">
            {persona.is_custom ? "Custom" : "System"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={`${isMobile ? 'p-4 pt-2' : 'pt-0'}`}>
        {persona.persona_description && (
          <p className={`${isMobile ? 'mobile-text-body' : 'text-sm'} text-muted-foreground mb-4 line-clamp-3 mobile-text-balance`}>
            {persona.persona_description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'}`} />
          <span className={`${isMobile ? 'mobile-text-caption' : 'text-sm'}`}>
            Created {new Date(persona.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};