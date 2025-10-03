import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ChevronRight, Mail, Calendar, Sparkles, Target, BarChart3 } from 'lucide-react';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface IdeaCardProps {
  idea: NewsletterIdea;
  onSelect: (idea: NewsletterIdea) => void;
  className?: string;
  isActive?: boolean;
  slideIndex?: number;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ 
  idea, 
  onSelect, 
  className, 
  isActive = false,
  slideIndex = 0 
}) => {
  // Get icon based on category
  const getIcon = (category: NewsletterIdea['category']) => {
    switch (category) {
      case 'holiday':
        return Calendar;
      case 'weekly':
        return Target;
      case 'seasonal':
        return Sparkles;
      case 'product':
        return BarChart3;
      case 'ai-generated':
        return Sparkles;
      default:
        return Mail;
    }
  };

  // Get gradient classes based on category - using dark colors like Home1Page
  const getGradientClasses = (category: NewsletterIdea['category']) => {
    switch (category) {
      case 'holiday':
        return "from-red-800 to-red-900";
      case 'weekly':
        return "from-green-800 to-green-900";
      case 'seasonal':
        return "from-purple-800 to-purple-900";
      case 'product':
        return "from-blue-800 to-blue-900";
      case 'ai-generated':
        return "from-orange-800 to-orange-900";
      default:
        return "from-gray-800 to-gray-900";
    }
  };

  const Icon = getIcon(idea.category);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-3xl bg-white shadow-lg border w-[150px] h-[420px]",
      "transition-all duration-500 ease-out cursor-pointer",
      isActive ? 'scale-105' : 'scale-95 opacity-70',
      className
    )}>
      {/* Gradient Background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-90",
        getGradientClasses(idea.category)
      )} />
      
      {/* Content */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between py-6 text-white">
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
          <div className="space-y-2">
            <h3 className="text-xl font-bold leading-tight text-white">{idea.title}</h3>
            <p className="text-white/90 text-sm leading-relaxed px-2 line-clamp-3">{idea.description}</p>
          </div>
          
          {/* Action Button */}
          <Button 
            onClick={() => onSelect(idea)}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm rounded-full px-6 py-2 text-sm font-medium transition-all duration-300"
            variant="outline"
          >
            Start with this
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
        
        {/* Bottom accent */}
        <div className="flex justify-center mt-4">
          <div className="w-12 h-1 bg-white/30 rounded-full">
            <div className="w-6 h-1 bg-white rounded-full"></div>
          </div>
        </div>
      </div>
      
      {/* Material You inspired overlay pattern */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
      
      {/* Slide label - show week number for weekly themes */}
      <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
        <span className="text-white/90 text-xs font-medium">
          {idea.category === 'weekly' && idea.weekNumber 
            ? `Week ${idea.weekNumber}`
            : `Idea ${slideIndex + 1}`
          }
        </span>
      </div>

      {/* Estimated read time badge */}
      {idea.estimatedReadTime && (
        <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-full flex items-center">
          <Clock className="w-3 h-3 mr-1 text-white/80" />
          <span className="text-white/90 text-xs">{idea.estimatedReadTime}</span>
        </div>
      )}
    </div>
  );
};