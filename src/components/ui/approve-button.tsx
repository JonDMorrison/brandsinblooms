
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

  const handleClick = async (event: React.MouseEvent) => {
    // Prevent event from bubbling up and potentially closing modals
    event.stopPropagation();
    event.preventDefault();
    
    if (isApproved || disabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      await onApprove(event);
    } catch (error) {
      console.error('Error approving:', error);
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
          : "bg-success/10 hover:bg-success/20 text-success border border-success/20 hover:border-success/30",
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
        children || "Approve"
      )}
    </Button>
  );
};
