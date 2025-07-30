import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { regenerateWorldVegetarianNewsletter } from '@/scripts/regenerateWorldVegetarianNewsletter';
import { RefreshCw } from 'lucide-react';

export const RegenerateNewsletterButton: React.FC = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    
    try {
      const result = await regenerateWorldVegetarianNewsletter();
      
      if (result.success) {
        toast({
          title: "Newsletter Regenerated Successfully",
          description: `World Vegetarian Day content updated with ${result.hasVegetableContent ? 'proper vegetable focus' : 'improved content'}`,
        });
        
        if (result.hasUnwantedContent) {
          toast({
            title: "Content Review Needed",
            description: "Some irrelevant themes may still be present. Please review the generated content.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Regeneration Failed",
          description: result.error || "Failed to regenerate newsletter content",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred during regeneration",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Button
      onClick={handleRegenerate}
      disabled={isRegenerating}
      variant="outline"
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
      {isRegenerating ? 'Regenerating...' : 'Regenerate World Vegetarian Day Newsletter'}
    </Button>
  );
};