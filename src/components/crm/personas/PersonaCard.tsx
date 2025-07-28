import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Edit, Trash2, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

interface PersonaCardProps {
  persona: {
    id: string;
    persona_name: string;
    persona_description?: string;
    is_custom: boolean;
    created_at: string;
  };
  onDelete: (personaId: string) => Promise<boolean>;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({ persona, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(persona.id);
    setIsDeleting(false);
  };

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
        {persona.is_custom && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className={`h-8 w-8 p-0 ${isMobile ? 'mobile-touch-target' : ''} mobile-focus-ring`}
              >
                <MoreHorizontal className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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