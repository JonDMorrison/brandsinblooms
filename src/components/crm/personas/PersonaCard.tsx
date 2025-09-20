import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  onViewDetails?: () => void;
  onCreateCampaign?: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona, onViewDetails, onCreateCampaign }) => {
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
        
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Users className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'}`} />
          <span className={`${isMobile ? 'mobile-text-caption' : 'text-sm'}`}>
            Created {new Date(persona.created_at).toLocaleDateString()}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'flex-col sm:flex-row gap-2'}`}>
          <Button 
            variant="outline" 
            size={isMobile ? "default" : "sm"} 
            onClick={onViewDetails}
            className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
          >
            View Details
          </Button>
          <Button 
            size={isMobile ? "default" : "sm"} 
            onClick={onCreateCampaign}
            className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
          >
            Create Campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};