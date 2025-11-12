import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIChatMessage } from './ai-chat-message';
import { AIChatPersistenceService } from '@/services/aiChatPersistence';

interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (imageUrl: string) => void;
  channel?: string;
  contentContext?: string;
  blockId?: string;
  contextType?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'images' | 'loading';
  content: string;
  images?: string[];
  imageRecordIds?: string[]; // IDs from ai_assistant_generated_images table
  timestamp: Date;
  isThinkingComplete?: boolean;
  thinkingDuration?: number;
}

export const AIPersonalizationDialog: React.FC<AIPersonalizationDialogProps> = ({
  open,
  onOpenChange,
  onImageSelect,
  channel = 'newsletter',
  contentContext = '',
  blockId,
  contextType = 'email_block'
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageRecordId, setSelectedImageRecordId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Chat persistence state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [oldestLoadedSequence, setOldestLoadedSequence] = useState<number | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize session when dialog opens
  useEffect(() => {
    if (open) {
      initializeSession();
    } else {
      // Reset state when dialog closes
      setInputPrompt('');
      setSelectedImage(null);
      setSelectedImageRecordId(null);
      setIsProcessing(false);
    }
  }, [open]);

  const initializeSession = async () => {
    try {
      const sessionId = await AIChatPersistenceService.findOrCreateSession({
        contextType,
        contextId: blockId,
        channel
      });
      
      setCurrentSessionId(sessionId);
      
      // Load initial 15 messages
      await loadInitialMessages(sessionId);
    } catch (error) {
      console.error('Failed to initialize session:', error);
      toast.error('Failed to load chat history');
    }
  };

  const loadInitialMessages = async (sessionId: string) => {
    try {
      const dbMessages = await AIChatPersistenceService.loadMessages(sessionId, 15);
      
      // Convert database messages to UI message format
      const uiMessages = await convertDBMessagesToUI(dbMessages);
      
      setMessages(uiMessages);
      setHasMoreMessages(dbMessages.length === 15);
      
      if (dbMessages.length > 0) {
        setOldestLoadedSequence(dbMessages[0].sequenceNumber);
      }
    } catch (error) {
      console.error('Failed to load initial messages:', error);
    }
  };

  const loadMoreMessages = async () => {
    if (!currentSessionId || !oldestLoadedSequence || isLoadingHistory) return;
    
    setIsLoadingHistory(true);
    
    try {
      const olderMessages = await AIChatPersistenceService.loadMessages(
        currentSessionId,
        5,
        oldestLoadedSequence
      );
      
      if (olderMessages.length > 0) {
        const uiMessages = await convertDBMessagesToUI(olderMessages);
        
        // Prepend to existing messages
        setMessages(prev => [...uiMessages, ...prev]);
        
        // Update oldest sequence tracker
        setOldestLoadedSequence(olderMessages[0].sequenceNumber);
        
        // If we got fewer than 5, no more messages exist
        setHasMoreMessages(olderMessages.length === 5);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const convertDBMessagesToUI = async (dbMessages: any[]): Promise<Message[]> => {
    const uiMessages: Message[] = [];
    
    for (const dbMsg of dbMessages) {
      if (dbMsg.messageType === 'user_prompt') {
        uiMessages.push({
          id: dbMsg.id,
          type: 'user',
          content: dbMsg.content,
          timestamp: new Date(dbMsg.createdAt)
        });
      } else if (dbMsg.messageType === 'thinking_text') {
        uiMessages.push({
          id: dbMsg.id,
          type: 'thinking',
          content: dbMsg.content,
          timestamp: new Date(dbMsg.createdAt),
          isThinkingComplete: true,
          thinkingDuration: dbMsg.metadata?.thinking_duration
        });
      } else if (dbMsg.messageType === 'images') {
        // Load images for this message
        const images = await AIChatPersistenceService.loadImagesForMessage(dbMsg.id);
        
        uiMessages.push({
          id: dbMsg.id,
          type: 'images',
          content: dbMsg.content,
          images: images.map(img => img.imageUrl),
          imageRecordIds: images.map(img => img.id),
          timestamp: new Date(dbMsg.createdAt)
        });
      }
    }
    
    return uiMessages;
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const scrollTop = target.scrollTop;
    
    // If scrolled to within 100px of top and not already loading
    if (scrollTop < 100 && !isLoadingHistory && hasMoreMessages && currentSessionId) {
      loadMoreMessages();
    }
  };

  const streamThinkingText = async (prompt: string, thinkingMessageId: string): Promise<string> => {
    const startTime = Date.now();
    try {
      console.log('🔄 Generating thinking text...');
      
      const { data, error } = await supabase.functions.invoke('generate-thinking-text', {
        body: { prompt }
      });
      
      if (error) {
        throw error;
      }
      
      if (!data?.thinkingText) {
        throw new Error('No thinking text received');
      }
      
      console.log('✅ Thinking text received');
      
      // Animate the text appearing character by character
      const fullText = data.thinkingText;
      let displayedText = '';
      
      for (let i = 0; i < fullText.length; i++) {
        displayedText += fullText[i];
        setMessages(prev =>
          prev.map(msg =>
            msg.id === thinkingMessageId
              ? { ...msg, content: displayedText, isThinkingComplete: false }
              : msg
          )
        );
        // Small delay for animation effect
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Mark as complete with duration
      const duration = Date.now() - startTime;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === thinkingMessageId
            ? { ...msg, isThinkingComplete: true, thinkingDuration: duration }
            : msg
        )
      );
      
      console.log('✅ Thinking text animation complete. Duration:', duration, 'ms');
      return fullText;
      
    } catch (error) {
      console.error('❌ Error generating thinking text:', error);
      const errorText = '⚠️ Unable to generate thinking text. Continuing with image generation...';
      setMessages(prev =>
        prev.map(msg =>
          msg.id === thinkingMessageId
            ? { 
                ...msg, 
                content: errorText,
                isThinkingComplete: true 
              }
            : msg
        )
      );
      return errorText;
    }
  };

  const generateImages = async (prompt: string) => {
    if (!currentSessionId) {
      toast.error('Session not initialized');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Step 1: Save and add user message
      const userMessageId = await AIChatPersistenceService.saveMessage({
        sessionId: currentSessionId,
        messageType: 'user_prompt',
        content: prompt,
        metadata: {}
      });
      
      const userMessage: Message = {
        id: userMessageId,
        type: 'user',
        content: prompt,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputPrompt('');

      // Step 2: Create thinking message and stream text
      const thinkingMessage: Message = {
        id: crypto.randomUUID(),
        type: 'thinking',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, thinkingMessage]);
      
      const thinkingStartTime = Date.now();
      const thinkingContent = await streamThinkingText(prompt, thinkingMessage.id);
      const thinkingDuration = Date.now() - thinkingStartTime;
      
      // Save thinking text to database
      if (thinkingContent) {
        await AIChatPersistenceService.saveMessage({
          sessionId: currentSessionId,
          messageType: 'thinking_text',
          content: thinkingContent,
          metadata: { thinking_duration: thinkingDuration }
        });
        console.log('💾 Thinking text saved to database');
      }
      
      // Brief pause before moving to next step
      await new Promise(resolve => setTimeout(resolve, 400));

      // Step 3: Show "Enhancing prompt" message
      const enhancingMessage: Message = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: '✨ Enhancing your prompt for optimal image generation...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, enhancingMessage]);

      // Step 4: Enhance prompt
      console.log('🎨 Enhancing prompt...');
      const { data: enhanceData } = await supabase.functions.invoke('enhance-image-prompt', {
        body: { prompt }
      });

      const enhancedPrompt = enhanceData?.enhancedPrompt || prompt;
      console.log('✨ Enhanced prompt:', enhancedPrompt);
      
      // Remove only the enhancing message (keep thinking message for history)
      setMessages(prev => prev.filter(msg => msg.id !== enhancingMessage.id));

      // Step 5: Show skeleton loaders for image generation
      const loadingMessage: Message = {
        id: crypto.randomUUID(),
        type: 'loading',
        content: 'Generating 3 unique images for you...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, loadingMessage]);

      // Step 6: Generate 3 images in parallel
      console.log('🎨 Generating 3 images...');
      const imagePromises = Array(3).fill(null).map(() =>
        supabase.functions.invoke('generate-ai-image', {
          body: {
            contentContext: enhancedPrompt,
            contentTitle: prompt,
            channel: channel,
            uploadToStorage: true
          }
        })
      );

      const results = await Promise.all(imagePromises);
      
      const imageUrls = results
        .filter(result => result.data?.imageUrl)
        .map(result => result.data.imageUrl);
      
      const globalImageIds = results
        .filter(result => result.data?.metadata?.globalImageId)
        .map(result => result.data.metadata.globalImageId);

      if (imageUrls.length === 0) {
        throw new Error('Failed to generate images');
      }

      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));

      // Step 7: Save and display images
      const imageMessageId = await AIChatPersistenceService.saveMessage({
        sessionId: currentSessionId,
        messageType: 'images',
        content: 'Here are 3 images based on your prompt:',
        metadata: { image_count: imageUrls.length }
      });
      
      // Save image records with references to global gallery
      if (globalImageIds.length > 0) {
        await AIChatPersistenceService.saveGeneratedImages({
          sessionId: currentSessionId,
          messageId: imageMessageId,
          userPrompt: prompt,
          enhancedPrompt: enhancedPrompt,
          images: globalImageIds.map((id, idx) => ({
            globalImageId: id,
            order: idx + 1
          }))
        });
        
        // Load the saved image records to get their IDs
        const savedImages = await AIChatPersistenceService.loadImagesForMessage(imageMessageId);
        
        const imageMessage: Message = {
          id: imageMessageId,
          type: 'images',
          content: 'Here are 3 images based on your prompt:',
          images: imageUrls,
          imageRecordIds: savedImages.map(img => img.id),
          timestamp: new Date()
        };
        setMessages(prev => [...prev, imageMessage]);
      } else {
        // Fallback if no globalImageIds (shouldn't happen)
        const imageMessage: Message = {
          id: imageMessageId,
          type: 'images',
          content: 'Here are 3 images based on your prompt:',
          images: imageUrls,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, imageMessage]);
      }

      console.log('✅ Successfully generated', imageUrls.length, 'images');

    } catch (error) {
      console.error('❌ Error generating images:', error);
      toast.error('Failed to generate images. Please try again.');
      
      // Remove only loading messages (keep thinking messages for history)
      setMessages(prev => prev.filter(msg => msg.type !== 'loading'));
      
      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: 'Sorry, I encountered an error generating images. Please try again with a different prompt.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isProcessing) return;
    
    await generateImages(inputPrompt.trim());
  };

  const handleImageSelect = (imageUrl: string, imageRecordId?: string) => {
    setSelectedImage(imageUrl);
    if (imageRecordId) {
      setSelectedImageRecordId(imageRecordId);
    }
  };

  const handleUseImage = async () => {
    if (selectedImage && selectedImageRecordId && blockId) {
      // Mark image as selected in database
      try {
        await AIChatPersistenceService.markImageSelected({
          imageRecordId: selectedImageRecordId,
          usedInContext: contextType,
          usedInId: blockId
        });
      } catch (error) {
        console.error('Failed to mark image as selected:', error);
      }
      
      onImageSelect(selectedImage);
      onOpenChange(false);
      toast.success('Image applied successfully!');
    } else if (selectedImage) {
      // Fallback if no record ID (shouldn't happen)
      onImageSelect(selectedImage);
      onOpenChange(false);
      toast.success('Image applied successfully!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogPortal>
        <DialogContent 
          className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden z-[9999]"
          onInteractOutside={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
        {/* Stunning backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 backdrop-blur-xl" />
        
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background/80 backdrop-blur-sm relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 h-8 w-8 rounded-full hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-gentle-pulse" />
              <DialogTitle className="text-xl font-semibold">AI Image Assistant</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Describe your vision and I'll create beautiful garden images for you
            </p>
          </DialogHeader>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef} onScroll={handleScroll}>
            {/* Loading indicator at top when fetching older messages */}
            {isLoadingHistory && (
              <div className="flex justify-center py-4 animate-fade-in">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {/* Show "No more messages" indicator */}
            {!hasMoreMessages && messages.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground animate-fade-in">
                Beginning of conversation
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-md animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Ready to create something beautiful?</h3>
                  <p className="text-sm text-muted-foreground">
                    Tell me what kind of garden image you'd like, and I'll generate multiple options for you to choose from.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {['spring flowers in bloom', 'sunset over garden', 'fresh vegetables'].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setInputPrompt(suggestion)}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <AIChatMessage
                key={message.id}
                message={message}
                selectedImage={selectedImage}
                onImageSelect={(imageUrl) => {
                  // Find the imageRecordId for this image URL
                  const imageIndex = message.images?.indexOf(imageUrl);
                  const imageRecordId = imageIndex !== undefined && imageIndex >= 0 
                    ? message.imageRecordIds?.[imageIndex] 
                    : undefined;
                  handleImageSelect(imageUrl, imageRecordId);
                }}
              />
            ))}
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Selected Image Indicator */}
          {selectedImage && (
            <div className="px-6 py-3 border-t bg-primary/5 backdrop-blur-sm animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground font-medium">Image selected!</p>
                <Button onClick={handleUseImage} size="sm" className="shadow-sm">
                  Use This Image
                </Button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="px-6 py-4 border-t bg-background/80 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="min-h-[60px] max-h-[120px] resize-none bg-background/50 focus:bg-background transition-colors"
                disabled={isProcessing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputPrompt.trim() || isProcessing}
                className="h-[60px] w-[60px] rounded-full shadow-lg hover:shadow-xl transition-all"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send • Shift + Enter for new line
            </p>
          </div>
        </div>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
