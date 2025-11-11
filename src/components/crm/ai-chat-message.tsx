import React from 'react';
import { cn } from '@/lib/utils';
import { ThinkingDots } from '@/components/ui/thinking-dots';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'images';
  content: string;
  images?: string[];
  timestamp: Date;
  thinkingSteps?: string[];
  currentStep?: number;
}

interface AIChatMessageProps {
  message: Message;
  selectedImage?: string | null;
  onImageSelect?: (imageUrl: string) => void;
}

export const AIChatMessage: React.FC<AIChatMessageProps> = ({
  message,
  selectedImage,
  onImageSelect
}) => {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end mb-4 animate-slide-in-right">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'thinking') {
    const currentThinkingText = message.thinkingSteps?.[message.currentStep || 0] || 'Thinking...';
    
    return (
      <div className="flex justify-start mb-4 animate-fade-in">
        <div className="max-w-[80%] bg-muted/40 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border-2 border-border/60">
          <div className="flex items-center gap-3">
            <ThinkingDots />
            <p className="text-sm text-foreground animate-fade-in">
              {currentThinkingText}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'images') {
    return (
      <div className="mb-6 animate-fade-in">
        <div className="flex justify-start mb-3">
          <div className="max-w-[80%] bg-muted/50 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm">
            <p className="text-sm text-foreground">{message.content}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {message.images?.map((imageUrl, idx) => (
            <button
              key={idx}
              onClick={() => onImageSelect?.(imageUrl)}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden transition-all duration-300",
                "hover:scale-105 hover:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                selectedImage === imageUrl && "ring-4 ring-primary scale-105"
              )}
            >
              <img
                src={imageUrl}
                alt={`Generated image ${idx + 1}`}
                className="w-full h-full object-cover animate-scale-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              />
              {selectedImage === imageUrl && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center animate-fade-in">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                    ✓
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-4 animate-slide-in-left">
      <div className="max-w-[80%] bg-muted/50 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm">
        <p className="text-sm text-foreground whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};
