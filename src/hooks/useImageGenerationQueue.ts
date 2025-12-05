/**
 * Image Generation Queue Hook
 * Prevents race conditions during parallel image generation
 * Ensures atomic updates to block state
 */

import { useRef, useCallback, useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { supabase } from '@/integrations/supabase/client';

interface QueuedImageTask {
  blockId: string;
  contentContext: string;
  contentTitle: string;
  channel: string;
  resolve: (imageUrl: string) => void;
  reject: (error: Error) => void;
}

interface UseImageGenerationQueueOptions {
  onImageGenerated: (blockId: string, imageUrl: string) => void;
  onImageFailed: (blockId: string, error: string) => void;
  maxConcurrent?: number;
}

export function useImageGenerationQueue(options: UseImageGenerationQueueOptions) {
  const { onImageGenerated, onImageFailed, maxConcurrent = 2 } = options;
  
  const queueRef = useRef<QueuedImageTask[]>([]);
  const activeCountRef = useRef(0);
  const processingRef = useRef(false);
  const generatedImagesRef = useRef<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  
  /**
   * Process the next item in the queue
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (activeCountRef.current >= maxConcurrent) return;
    if (queueRef.current.length === 0) {
      setIsProcessing(false);
      return;
    }
    
    processingRef.current = true;
    setIsProcessing(true);
    
    const task = queueRef.current.shift();
    if (!task) {
      processingRef.current = false;
      return;
    }
    
    // Check if we already generated an image for this block (prevent duplicates)
    if (generatedImagesRef.current.has(task.blockId)) {
      console.log(`🚫 [ImageQueue] Block ${task.blockId} already has generated image, skipping`);
      const existingUrl = generatedImagesRef.current.get(task.blockId)!;
      task.resolve(existingUrl);
      processingRef.current = false;
      processQueue();
      return;
    }
    
    activeCountRef.current++;
    console.log(`🎨 [ImageQueue] Processing block ${task.blockId} (${activeCountRef.current}/${maxConcurrent} active)`);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          contentContext: task.contentContext,
          contentTitle: task.contentTitle,
          channel: task.channel,
          uploadToStorage: true,
        }
      });
      
      if (error) throw error;
      
      const imageUrl = data?.imageUrl;
      if (!imageUrl) {
        throw new Error('No image URL returned from generation');
      }
      
      // Store the generated image URL
      generatedImagesRef.current.set(task.blockId, imageUrl);
      
      console.log(`✅ [ImageQueue] Generated image for block ${task.blockId}`);
      onImageGenerated(task.blockId, imageUrl);
      task.resolve(imageUrl);
      
    } catch (error: any) {
      console.error(`❌ [ImageQueue] Failed to generate image for block ${task.blockId}:`, error);
      onImageFailed(task.blockId, error.message || 'Image generation failed');
      task.reject(error);
    } finally {
      activeCountRef.current--;
      processingRef.current = false;
      
      // Process next item
      setTimeout(() => processQueue(), 100);
    }
  }, [maxConcurrent, onImageGenerated, onImageFailed]);
  
  /**
   * Enqueue a block for image generation
   */
  const enqueueImageGeneration = useCallback((
    blockId: string,
    contentContext: string,
    contentTitle: string,
    channel: string = 'newsletter'
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Check if already queued
      const existingTask = queueRef.current.find(t => t.blockId === blockId);
      if (existingTask) {
        console.log(`🚫 [ImageQueue] Block ${blockId} already in queue`);
        return;
      }
      
      // Check if already generated
      if (generatedImagesRef.current.has(blockId)) {
        const existingUrl = generatedImagesRef.current.get(blockId)!;
        console.log(`✅ [ImageQueue] Block ${blockId} already has image, returning cached`);
        resolve(existingUrl);
        return;
      }
      
      console.log(`📥 [ImageQueue] Enqueueing block ${blockId}`);
      queueRef.current.push({
        blockId,
        contentContext,
        contentTitle,
        channel,
        resolve,
        reject
      });
      
      processQueue();
    });
  }, [processQueue]);
  
  /**
   * Enqueue multiple blocks for image generation
   */
  const enqueueMultipleBlocks = useCallback((
    blocks: ContentBlock[],
    campaignTitle: string
  ) => {
    const blocksNeedingImages = blocks.filter(block => {
      // Check for image-bearing block types
      const needsImage = (block.type === 'image-text' || block.type === 'image');
      const hasImage = !!(block.imageUrl && block.imageUrl !== 'loading');
      const isGenerating = block.isGeneratingImage;
      return needsImage && !hasImage && !isGenerating;
    });
    
    console.log(`📥 [ImageQueue] Enqueueing ${blocksNeedingImages.length} blocks for image generation`);
    
    blocksNeedingImages.forEach(block => {
      const contentContext = block.body || block.content || block.headline || campaignTitle;
      const contentTitle = block.headline || block.title || campaignTitle;
      
      enqueueImageGeneration(block.id, contentContext, contentTitle);
    });
  }, [enqueueImageGeneration]);
  
  /**
   * Clear the queue and reset state
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    generatedImagesRef.current.clear();
    setIsProcessing(false);
  }, []);
  
  /**
   * Get current queue status
   */
  const getQueueStatus = useCallback(() => ({
    queueLength: queueRef.current.length,
    activeCount: activeCountRef.current,
    generatedCount: generatedImagesRef.current.size,
    isProcessing
  }), [isProcessing]);
  
  return {
    enqueueImageGeneration,
    enqueueMultipleBlocks,
    clearQueue,
    getQueueStatus,
    isProcessing
  };
}
