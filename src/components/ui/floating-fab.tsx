import React, { useState } from 'react';
import { HelpCircle, Bell, X, MessageSquare, BookOpenCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface FloatingFABProps {
  notificationCount?: number;
  onHelpClick?: () => void;
  onNotificationClick?: () => void;
  className?: string;
}

export const FloatingFAB = ({
  notificationCount = 0,
  onHelpClick,
  onNotificationClick,
  className = ''
}: FloatingFABProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleHelpAction = (action: string) => {
    setIsOpen(false);
    
    switch (action) {
      case 'documentation':
        window.open('https://docs.lovable.dev/', '_blank');
        break;
      case 'support':
        toast.info('Support chat feature coming soon!');
        break;
      case 'feedback':
        toast.info('Feedback form coming soon!');
        break;
      case 'shortcuts':
        toast.info('Keyboard shortcuts: Cmd/Ctrl + K for quick actions');
        break;
      default:
        onHelpClick?.();
    }
  };

  const handleNotificationAction = () => {
    setIsOpen(false);
    onNotificationClick?.();
    toast.info('Notifications panel coming soon!');
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-150 bg-white border-2 border-gray-200 hover:border-brand-teal group"
          >
            <div className="flex items-center justify-center w-full h-full relative">
              {/* Left side - Notifications */}
              <div className="absolute left-0 w-1/2 h-full flex items-center justify-center">
                <Bell className="w-4 h-4 text-brand-navy group-hover:text-brand-teal transition-colors" />
                {notificationCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center text-xs p-0"
                  >
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Badge>
                )}
              </div>
              
              {/* Divider */}
              <div className="absolute inset-y-2 left-1/2 w-px bg-gray-200 group-hover:bg-brand-teal/30 transition-colors" />
              
              {/* Right side - Help */}
              <div className="absolute right-0 w-1/2 h-full flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-brand-navy group-hover:text-brand-teal transition-colors" />
              </div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          align="end" 
          side="top"
          className="w-64 mb-2 shadow-xl border-gray-200"
        >
          {/* Notifications Section */}
          <DropdownMenuLabel className="flex items-center gap-2 text-brand-navy">
            <Bell className="w-4 h-4" />
            Notifications
            {notificationCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {notificationCount}
              </Badge>
            )}
          </DropdownMenuLabel>
          
          <DropdownMenuItem 
            onClick={handleNotificationAction}
            className="focus:bg-brand-teal/10 focus:text-brand-navy cursor-pointer"
          >
            <div className="flex flex-col items-start">
              <span className="font-medium">View all notifications</span>
              <span className="text-xs text-gray-500">Stay updated with your content</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Help Section */}
          <DropdownMenuLabel className="flex items-center gap-2 text-brand-navy">
            <HelpCircle className="w-4 h-4" />
            Help & Support
          </DropdownMenuLabel>
          
          <DropdownMenuItem 
            onClick={() => handleHelpAction('documentation')}
            className="focus:bg-brand-teal/10 focus:text-brand-navy cursor-pointer"
          >
            <BookOpenCheck className="w-4 h-4 mr-2" />
            <div className="flex flex-col items-start">
              <span>Documentation</span>
              <span className="text-xs text-gray-500">Learn how to use BloomSuite</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleHelpAction('support')}
            className="focus:bg-brand-teal/10 focus:text-brand-navy cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            <div className="flex flex-col items-start">
              <span>Contact Support</span>
              <span className="text-xs text-gray-500">Get help from our team</span>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleHelpAction('shortcuts')}
            className="focus:bg-brand-teal/10 focus:text-brand-navy cursor-pointer"
          >
            <div className="flex flex-col items-start">
              <span>Keyboard Shortcuts</span>
              <span className="text-xs text-gray-500">Speed up your workflow</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};