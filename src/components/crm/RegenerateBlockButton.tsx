import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Scissors } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock } from '@/types/emailBuilder';
import { normalizeAIResponse, applyAIToBlock } from '@/lib/newsletter/aiMapping';
import { createBlockPrompt, createShortenBlockPrompt } from '@/utils/blockPromptBuilder';

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

  const handleAction = async (action: 'regenerate' | 'shorten') => {
    if (regenerating) return;
    
    setRegenerating(true);
    
    try {
      const topic = campaignName || block.title || 'Newsletter';
      const previousBlocks = allBlocks.slice(0, blockIndex).filter(b => b.type !== 'header' && b.type !== 'divider');

      // Use appropriate prompt builder based on action
      const enhancedPrompt = action === 'shorten' 
        ? createShortenBlockPrompt(block, topic, '', blockIndex, previousBlocks, allBlocks.length)
        : createBlockPrompt(block, topic, '', blockIndex, previousBlocks, allBlocks.length);

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

      console.log(`[AI] ${action} block invoke:`, { blockId: block.id, payload });
      const { data, error } = await supabase.functions.invoke('generate-email-content', { 
        body: payload 
      });
      
      console.log(`[AI] ${action} block response:`, { blockId: block.id, error, data });
      
      if (error) {
        throw new Error(error.message || 'AI generation failed');
      }

      const normalizedAI = normalizeAIResponse(data);
      const updatedBlock = applyAIToBlock(block, normalizedAI);
      
      onUpdate(updatedBlock);
      
      toast({
        title: action === 'shorten' ? "Block Shortened" : "Block Regenerated",
        description: action === 'shorten' 
          ? "Content has been shortened by ~50% while preserving key information"
          : "Content has been updated with fresh AI-generated content",
      });
    } catch (error: any) {
      console.error(`Block ${action} failed:`, error);
      toast({
        title: action === 'shorten' ? "Shortening Failed" : "Regeneration Failed",
        description: error.message || `Failed to ${action} content. Try again.`,
        variant: "destructive"
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={regenerating}
                className="h-7 w-7 p-0 hover:bg-primary hover:text-primary-foreground"
              >
                {regenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleAction('regenerate')}>
                <Sparkles className="w-3 h-3 mr-2" />
                Regenerate (fresh)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('shorten')}>
                <Scissors className="w-3 h-3 mr-2" />
                Shorten by 50%
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Options</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};