
import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SuccessFeedbackProps {
  contentId: string;
  action: 'scheduled' | 'published';
  timestamp?: string;
  onAnimationComplete?: () => void;
}

export const showSuccessToast = (action: 'scheduled' | 'published', timestamp?: string) => {
  // Only show toast for scheduling - users can see publish status in UI
  if (action === 'scheduled') {
    const message = `✓ Scheduled for ${timestamp || 'later'}`;
    
    toast.success(message, {
      duration: 2000,
      icon: <Clock className="w-4 h-4" />,
      style: {
        background: '#22C55E',
        color: 'white',
        border: 'none',
      },
    });
  }
  // Remove publish success toast - redundant with UI feedback
};

export const triggerCardPulse = (contentId: string) => {
  const cardElement = document.querySelector(`[data-content-id="${contentId}"]`);
  if (cardElement) {
    cardElement.classList.add('animate-pulse-mint');
    setTimeout(() => {
      cardElement.classList.remove('animate-pulse-mint');
    }, 300);
  }
};

export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({ 
  contentId, 
  action, 
  timestamp, 
  onAnimationComplete 
}) => {
  useEffect(() => {
    // Show toast
    showSuccessToast(action, timestamp);
    
    // Trigger card pulse animation
    triggerCardPulse(contentId);
    
    // Call completion callback
    setTimeout(() => {
      onAnimationComplete?.();
    }, 300);
  }, [contentId, action, timestamp, onAnimationComplete]);

  return null;
};
