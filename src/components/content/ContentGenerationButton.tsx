import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckSquare } from 'lucide-react';
import { ImprovedContentGenerationModal } from './ImprovedContentGenerationModal';
import { useCreateFlow } from '@/state/useCreateFlow';
import { Badge } from '@/components/ui/badge';

interface ContentGenerationButtonProps {
  campaignId?: string;
  campaignTitle?: string; 
  theme?: string;
  description?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export const ContentGenerationButton: React.FC<ContentGenerationButtonProps> = ({
  campaignId,
  campaignTitle = 'Content Generation',
  theme,
  description,
  size = 'default',
  variant = 'default', 
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { channels } = useCreateFlow();

  const selectedCount = channels ? Object.values(channels).filter(Boolean).length : 0;

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="space-y-2">
        <Button
          onClick={handleOpenModal}
          size={size}
          variant={variant}
          className={`${className} bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white border-none shadow-md hover:shadow-lg transition-all`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Content Pack
        </Button>
        
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckSquare className="w-3 h-3" />
            <span>{selectedCount} content types selected</span>
          </div>
        )}
      </div>

      <ImprovedContentGenerationModal 
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
};