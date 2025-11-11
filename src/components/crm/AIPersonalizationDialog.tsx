import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIChatMessage } from './ai-chat-message';

interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (imageUrl: string) => void;
  channel?: string;
  contentContext?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'images' | 'loading';
  content: string;
  images?: string[];
  timestamp: Date;
  isThinkingComplete?: boolean;
}

export const AIPersonalizationDialog: React.FC<AIPersonalizationDialogProps> = ({
  open,
  onOpenChange,
  onImageSelect,
  channel = 'newsletter',
  contentContext = ''
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInputPrompt('');
      setSelectedImage(null);
      setIsProcessing(false);
    }
  }, [open]);

  const streamThinkingText = async (prompt: string, thinkingMessageId: string): Promise<void> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/stream-thinking-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({ prompt })
        }
      );
      
      if (!response.ok || !response.body) {
        throw new Error('Streaming failed');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let textBuffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === thinkingMessageId
                    ? { ...msg, content: fullText }
                    : msg
                )
              );
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
          }
        }
      }
      
      // Mark thinking as complete
      setMessages(prev =>
        prev.map(msg =>
          msg.id === thinkingMessageId
            ? { ...msg, isThinkingComplete: true }
            : msg
        )
      );
      
      console.log('✅ Thinking text streaming complete');
    } catch (error) {
      console.error('❌ Streaming error:', error);
      // Fallback text
      setMessages(prev =>
        prev.map(msg =>
          msg.id === thinkingMessageId
            ? { 
                ...msg, 
                content: 'Hmm, analyzing your request and considering the best visual composition for your garden image. I\'m thinking about the lighting, colors, and seasonal elements that would work perfectly...',
                isThinkingComplete: true 
              }
            : msg
        )
      );
    }
  };

  const generateImages = async (prompt: string) => {
    setIsProcessing(true);
    
    try {
      // Step 1: Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
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
      
      await streamThinkingText(prompt, thinkingMessage.id);
      
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

      if (imageUrls.length === 0) {
        throw new Error('Failed to generate images');
      }

      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));

      // Step 7: Display images
      const imageMessage: Message = {
        id: crypto.randomUUID(),
        type: 'images',
        content: 'Here are 3 images based on your prompt:',
        images: imageUrls,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, imageMessage]);

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

  const handleImageSelect = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleUseImage = () => {
    if (selectedImage) {
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
          <DialogHeader className="px-6 py-4 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary animate-gentle-pulse" />
              <DialogTitle className="text-xl font-semibold">AI Image Assistant</DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Describe your vision and I'll create beautiful garden images for you
            </p>
          </DialogHeader>

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-6 py-4" ref={scrollAreaRef}>
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
                onImageSelect={handleImageSelect}
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
