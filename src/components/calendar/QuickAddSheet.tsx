import React, { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar, 
  Mail, 
  Megaphone, 
  FileText, 
  Instagram, 
  Facebook,
  ChevronRight 
} from 'lucide-react';
import { format } from 'date-fns';

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onCreateSocialPost: (date: Date) => void;
  onCreateNewsletter: (date: Date) => void;
  onCreateEvent: (date: Date) => void;
  onCreateTask: (date: Date) => void;
}

interface QuickAddOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  action: (date: Date) => void;
}

export const QuickAddSheet = ({
  isOpen,
  onClose,
  selectedDate,
  onCreateSocialPost,
  onCreateNewsletter,
  onCreateEvent,
  onCreateTask
}: QuickAddSheetProps) => {
  if (!selectedDate) return null;

  const options: QuickAddOption[] = [
    {
      id: 'social',
      title: 'Social Media Post',
      description: 'Create Instagram, Facebook, or other social content',
      icon: Instagram,
      color: 'from-pink-500 to-purple-600',
      action: onCreateSocialPost
    },
    {
      id: 'newsletter',
      title: 'Newsletter',
      description: 'Schedule an email newsletter campaign',
      icon: Mail,
      color: 'from-blue-500 to-cyan-600',
      action: onCreateNewsletter
    },
    {
      id: 'event',
      title: 'Event to Promote',
      description: 'Create a promotional campaign for an event',
      icon: Megaphone,
      color: 'from-orange-500 to-red-600',
      action: onCreateEvent
    },
    {
      id: 'task',
      title: 'General Task',
      description: 'Add a content task or reminder',
      icon: FileText,
      color: 'from-gray-500 to-slate-600',
      action: onCreateTask
    }
  ];

  const handleOptionClick = (option: QuickAddOption) => {
    option.action(selectedDate);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-xl">Add Content</SheetTitle>
              <SheetDescription className="text-base">
                for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {options.map((option) => {
            const IconComponent = option.icon;
            return (
              <Card 
                key={option.id} 
                className="cursor-pointer hover:shadow-md transition-all duration-200 border-2 hover:border-primary/20 group"
                onClick={() => handleOptionClick(option)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 bg-gradient-to-br ${option.color} rounded-xl shadow-sm group-hover:shadow-md transition-shadow`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {option.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> You can also drag existing content between dates to reschedule them quickly.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};