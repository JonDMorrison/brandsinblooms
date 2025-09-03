import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CelebrationConfetti } from '@/components/ui/celebration-confetti';
import { Calendar, ArrowLeft } from 'lucide-react';

interface PlanSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PlanSuccessModal: React.FC<PlanSuccessModalProps> = ({
  open,
  onOpenChange
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Extract launch details from URL params
  const month = searchParams.get('launchMonth') || 'your plan';
  const itemCount = searchParams.get('launchItems') || '0';
  
  useEffect(() => {
    if (open) {
      setShowConfetti(true);
      
      // Clear launch params from URL after modal opens
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('launchMonth');
      newParams.delete('launchItems');
      newParams.delete('planLaunched');
      
      const newUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [open, searchParams]);

  const handleViewCalendar = () => {
    onOpenChange(false);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <CelebrationConfetti 
        trigger={showConfetti} 
        onComplete={() => setShowConfetti(false)} 
      />
      
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              🎉 Your {month} Plan is Ready!
            </DialogTitle>
            
            <p className="text-muted-foreground">
              {itemCount} items have been scheduled across Email, SMS, and Social. 
              You can view or edit them anytime in your calendar.
            </p>
          </DialogHeader>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button 
              onClick={handleViewCalendar}
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <Calendar className="h-4 w-4 mr-2" />
              View My Calendar
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleBackToDashboard}
              className="flex-1"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};