
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface ApproveButtonProps {
  taskId?: string;
  isApproved: boolean;
  onApprove: (event: React.MouseEvent) => Promise<void> | void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
  requiresConfirmation?: boolean;
}

export const ApproveButton = ({ 
  taskId,
  isApproved, 
  onApprove, 
  disabled = false, 
  size = "sm",
  className,
  children,
  requiresConfirmation = false
}: ApproveButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (event: React.MouseEvent) => {
    // Prevent event from bubbling up and potentially closing modals
    event.stopPropagation();
    event.preventDefault();
    
    if (isApproved || disabled || isLoading) {
      console.log('🚫 APPROVE_BUTTON: Click ignored', {
        isApproved,
        disabled,
        isLoading,
        taskId
      });
      return;
    }
    
    console.log('🎯 APPROVE_BUTTON: Starting approval process', {
      taskId,
      requiresConfirmation
    });
    
    // Add confirmation dialog for explicit approval
    if (requiresConfirmation || !isApproved) {
      const confirmed = window.confirm(
        'Are you sure you want to approve this content? ' +
        'It will be moved to the "Ready to Post" section.'
      );
      
      if (!confirmed) {
        console.log('🚫 APPROVE_BUTTON: User cancelled approval');
        return;
      }
    }
    
    setIsLoading(true);
    
    try {
      console.log('🎯 APPROVE_BUTTON: Calling onApprove handler');
      await onApprove(event);
      console.log('✅ APPROVE_BUTTON: Approval completed successfully');
      
      // Additional verification - check if status was actually updated
      if (taskId) {
        setTimeout(async () => {
          try {
            const { data: updatedTask, error } = await supabase
              .from('content_tasks')
              .select('status')
              .eq('id', taskId)
              .single();
            
            if (error) {
              console.error('❌ APPROVE_BUTTON: Error verifying approval status:', error);
            } else {
              console.log('🔍 APPROVE_BUTTON: Verification - Current status:', updatedTask.status);
              if (updatedTask.status !== 'approved' && updatedTask.status !== 'posted') {
                console.warn('⚠️ APPROVE_BUTTON: Status verification failed - expected approved/posted, got:', updatedTask.status);
                toast.error('Approval may not have completed properly. Please refresh and try again.');
              }
            }
          } catch (verifyError) {
            console.error('❌ APPROVE_BUTTON: Verification error:', verifyError);
          }
        }, 1000);
      }
      
    } catch (error) {
      console.error('❌ APPROVE_BUTTON: Approval failed:', error);
      toast.error('Failed to approve content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading || isApproved}
      className={cn(
        "transition-colors duration-300",
        isApproved
          ? "bg-success hover:bg-success/90 text-success-foreground border-success"
          : "bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 hover:border-blue-400",
        className
      )}
      type="button"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Approving...
        </>
      ) : isApproved ? (
        <>
          <CheckCircle className="w-3 h-3 mr-1" />
          {children || "Approved"}
        </>
      ) : (
        <>
          <Clock className="w-3 h-3 mr-1" />
          {children || "Approve"}
        </>
      )}
    </Button>
  );
};
