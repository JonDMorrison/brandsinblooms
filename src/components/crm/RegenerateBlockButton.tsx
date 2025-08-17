import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock } from '@/types/emailBuilder';
import { normalizeAIResponse, applyAIToBlock } from '@/lib/newsletter/aiMapping';
import { createBlockPrompt } from '@/utils/blockPromptBuilder';

interface RegenerateBlockButtonProps {
  block: ContentBlock;
  campaignName?: string;
  onUpdate: (updatedBlock: ContentBlock) => void;
  allBlocks?: ContentBlock[];
  blockIndex?: number;
}

export const RegenerateBlockButton: React.FC<RegenerateBlockButtonProps> = ({
  block,
  campaignName,
  onUpdate,
  allBlocks = [],
  blockIndex = 0
}) => {
  const [regenerating, setRegenerating] = useState(false);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    if (regenerating) return;
    
    setRegenerating(true);
    
    try {
      const topic = campaignName || block.title || 'Newsletter';
      const previousBlocks = allBlocks.slice(0, blockIndex).filter(b => b.type !== 'header' && b.type !== 'divider');

      // Use the enhanced block prompt builder
      const enhancedPrompt = createBlockPrompt(
        block,
        topic,
        '',
        blockIndex,
        previousBlocks,
        allBlocks.length
      );

      const payload = {
        prompt: enhancedPrompt,
        type: 'email_block',
        postType: 'newsletter',
        campaignTitle: topic,
        campaignContext: '',
        blockIndex,
        previousBlocks,
        totalBlocks: allBlocks.length
      };

      console.log('[AI] regenerate block invoke:', { blockId: block.id, payload });
      const { data, error } = await supabase.functions.invoke('generate-email-content', { 
        body: payload 
      });
      
      console.log('[AI] regenerate block response:', { blockId: block.id, error, data });
      
      if (error) {
        throw new Error(error.message || 'AI generation failed');
      }

      const normalizedAI = normalizeAIResponse(data);
      const updatedBlock = applyAIToBlock(block, normalizedAI);
      
      onUpdate(updatedBlock);
      
      toast({
        title: "Block Regenerated",
        description: "Content has been updated with fresh AI-generated content",
      });
    } catch (error: any) {
      console.error('Block regeneration failed:', error);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate content. Try again.",
        variant: "destructive"
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRegenerate}
      disabled={regenerating}
      className="text-xs h-7 px-2"
    >
      {regenerating ? (
        <>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Regenerating...
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3 mr-1" />
          Regenerate with AI
        </>
      )}
    </Button>
  );
};