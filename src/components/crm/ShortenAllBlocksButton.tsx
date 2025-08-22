import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Scissors, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock } from '@/types/emailBuilder';
import { normalizeAIResponse, applyAIToBlock } from '@/lib/newsletter/aiMapping';
import { createShortenBlockPrompt } from '@/utils/blockPromptBuilder';

interface ShortenAllBlocksButtonProps {
  blocks: ContentBlock[];
  campaignName?: string;
  onUpdate: (blockId: string, updatedBlock: ContentBlock) => void;
  className?: string;
}

export const ShortenAllBlocksButton: React.FC<ShortenAllBlocksButtonProps> = ({
  blocks,
  campaignName,
  onUpdate,
  className = ''
}) => {
  const [processing, setProcessing] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const { toast } = useToast();

  const handleShortenAll = async () => {
    if (processing) return;
    
    // Filter to content blocks only (skip headers and dividers)
    const contentBlocks = blocks.filter(b => b.type !== 'header' && b.type !== 'divider');
    
    if (contentBlocks.length === 0) {
      toast({
        title: "No Content to Shorten",
        description: "No content blocks found to shorten.",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        const blockIndex = blocks.findIndex(b => b.id === block.id);
        setCurrentBlock(i + 1);

        try {
          const topic = campaignName || block.title || 'Newsletter';
          const previousBlocks = blocks.slice(0, blockIndex).filter(b => b.type !== 'header' && b.type !== 'divider');

          const shortenPrompt = createShortenBlockPrompt(
            block,
            topic,
            '',
            blockIndex,
            previousBlocks,
            blocks.length
          );

          const payload = {
            prompt: shortenPrompt,
            type: 'email_block',
            postType: 'newsletter',
            campaignTitle: topic,
            campaignContext: '',
            blockIndex,
            previousBlocks,
            totalBlocks: blocks.length
          };

          console.log('[AI] shorten block invoke:', { blockId: block.id, payload });
          const { data, error } = await supabase.functions.invoke('generate-email-content', { 
            body: payload 
          });

          if (error) {
            throw new Error(error.message || 'AI generation failed');
          }

          const normalizedAI = normalizeAIResponse(data);
          const updatedBlock = applyAIToBlock(block, normalizedAI);
          
          onUpdate(block.id, updatedBlock);
          successCount++;

          // Small delay between requests to avoid overwhelming the API
          if (i < contentBlocks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Failed to shorten block ${block.id}:`, error);
          errorCount++;
        }
      }

      // Show completion toast
      if (successCount > 0 && errorCount === 0) {
        toast({
          title: "All Blocks Shortened",
          description: `Successfully shortened ${successCount} content blocks by ~50%`,
        });
      } else if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Partially Completed",
          description: `Shortened ${successCount} blocks, failed on ${errorCount} blocks`,
        });
      } else {
        toast({
          title: "Shortening Failed",
          description: "Failed to shorten content blocks. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Bulk shortening failed:', error);
      toast({
        title: "Shortening Failed",
        description: error.message || "Failed to shorten content. Try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
      setCurrentBlock(null);
    }
  };

  const contentBlockCount = blocks.filter(b => b.type !== 'header' && b.type !== 'divider').length;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShortenAll}
      disabled={processing || contentBlockCount === 0}
      className={`flex items-center space-x-2 ${className}`}
    >
      {processing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Shortening {currentBlock}/{contentBlockCount}...</span>
        </>
      ) : (
        <>
          <Scissors className="h-4 w-4" />
          <span>Shorten All by 50%</span>
        </>
      )}
    </Button>
  );
};