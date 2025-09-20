import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { PersonaDetailsDialog } from './PersonaDetailsDialog';

interface PersonaCardProps {
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
    created_at: string;
  };
  customerCount?: number;
  onViewDetails?: () => void;
  onCreateCampaign?: () => void;
  onAssignmentChange?: () => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona, customerCount = 0, onViewDetails, onCreateCampaign, onAssignmentChange }) => {
  console.log('🔧 PersonaCard render:', { personaName: persona.persona_name, customerCount });
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const isMobile = useIsMobile();

  const handleViewDetails = () => {
    console.log('🔍 PersonaCard: View Details clicked', { persona: persona.persona_name, hasOnViewDetails: !!onViewDetails });
    if (onViewDetails) {
      console.log('🔍 PersonaCard: Calling onViewDetails prop');
      onViewDetails();
    } else {
      console.log('🔍 PersonaCard: Setting showDetailsDialog to true');
      setShowDetailsDialog(true);
    }
  };

  return (
    <>
      <Card className="h-full mobile-hover-lift mobile-card flex flex-col">
        <CardHeader className={`${isMobile ? 'p-4 pb-2' : 'pb-3'} flex flex-row items-start justify-between space-y-0`}>
          <div className="flex-1 min-w-0">
            <CardTitle className={`${isMobile ? 'mobile-text-subheading' : 'text-base'} mb-1 mobile-prevent-overflow`}>
              {persona.persona_name}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Badge variant={persona.is_custom ? "default" : "secondary"} className="text-xs">
                {persona.is_custom ? "Custom" : "System"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Customers: {customerCount}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`${isMobile ? 'p-4 pt-2' : 'pt-0'} flex-1 flex flex-col`}>
          <div className="flex-1">
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
          </div>
          
          {/* Action buttons - always at bottom */}
          <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'flex-col sm:flex-row gap-2'} mt-auto`}>
          <Button 
            variant="outline" 
            size={isMobile ? "default" : "sm"} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleViewDetails();
            }}
            className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
          >
            View Details
          </Button>
          <Button 
            size={isMobile ? "default" : "sm"} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreateCampaign?.();
            }}
            className={`${isMobile ? 'w-full min-h-[44px]' : 'flex-1 min-w-0'}`}
          >
            Create Campaign
          </Button>
          </div>
        </CardContent>
      </Card>

      <PersonaDetailsDialog
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        persona={persona}
        onAssignmentChange={onAssignmentChange}
      />
    </>
  );
};