
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApproveButtonProps {
  isApproved: boolean;
  onApprove: (event: React.MouseEvent) => Promise<void> | void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
}

export const ApproveButton = ({ 
  isApproved, 
  onApprove, 
  disabled = false, 
  size = "sm",
  className,
  children
}: ApproveButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasBeenApproved, setHasBeenApproved] = useState(isApproved);

  const handleClick = async (event: React.MouseEvent) => {
    // Prevent event from bubbling up and potentially closing modals
    event.stopPropagation();
    event.preventDefault();
    
    if (isApproved || hasBeenApproved || disabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      await onApprove(event);
      setHasBeenApproved(true);
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approved = isApproved || hasBeenApproved;

  return (
    <Button
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading || approved}
      className={cn(
        "transition-all duration-300 transform",
        approved
          ? "bg-green-600 hover:bg-green-700 text-white"
          : "bg-green-50 hover:bg-green-100 text-gray-900 border border-green-200",
        "active:scale-95",
        isLoading && "scale-95",
        className
      )}
      type="button" // Explicitly set type to prevent form submission
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Approving...
        </>
      ) : approved ? (
        <>
          <CheckCircle className="w-3 h-3 mr-1" />
          {children || "Approved"}
        </>
      ) : (
        children || "Approve"
      )}
    </Button>
  );
};
