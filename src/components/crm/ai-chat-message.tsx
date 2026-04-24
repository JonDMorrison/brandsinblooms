import React from 'react';
import { cn } from '@/lib/utils';
import { ThinkingDots } from '@/components/ui-legacy/thinking-dots';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'images' | 'loading' | 'session_divider';
  content: string;
  images?: string[];
  timestamp: Date;
  isThinkingComplete?: boolean;
  thinkingDuration?: number; // Duration in milliseconds
  sessionInfo?: {
    sessionId: string;
    title: string | null;
    contextType: string | null;
    channel: string | null;
    createdAt: string;
  };
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
  const [isExpanded, setIsExpanded] = React.useState(true);
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
    const isComplete = message.isThinkingComplete;
    
    return (
      <div className="flex justify-start mb-4 animate-fade-in">
        <div className="max-w-[80%] bg-muted/40 rounded-2xl rounded-tl-md px-4 py-3 shadow-md border border-gray-200 transition-all duration-300">
          <div className="flex items-start gap-3">
            {!isComplete && <ThinkingDots className="mt-1 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              {isComplete && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 group"
                >
                  <span className="font-medium">
                    {message.thinkingDuration 
                      ? `Thought for ${(message.thinkingDuration / 1000).toFixed(2)} seconds`
                      : 'Thinking Process'
                    }
                  </span>
                  <svg
                    className={cn(
                      "w-4 h-4 transition-transform duration-300",
                      isExpanded ? "rotate-180" : ""
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-500 ease-in-out",
                  isComplete && !isExpanded ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                )}
              >
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed animate-text-stream">
                  {message.content || 'Thinking...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.type === 'loading') {
    return (
      <div className="mb-6 animate-fade-in">
        <div className="flex justify-start mb-3">
          <div className="max-w-[80%] bg-muted/40 rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm border border-gray-200">
            <p className="text-sm text-foreground">{message.content}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="aspect-square rounded-lg overflow-hidden"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div 
                className="w-full h-full animate-shimmer-fast"
                style={{
                  background: 'linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--muted) / 0.7) 50%, hsl(var(--muted)) 100%)',
                  backgroundSize: '200% 100%'
                }}
              />
            </div>
          ))}
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
