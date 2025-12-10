import React from 'react';
import { Check, Loader2, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AutoSaveStatusBarProps {
  isSaving: boolean;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
  error?: boolean;
  className?: string;
}

export const AutoSaveStatusBar: React.FC<AutoSaveStatusBarProps> = ({
  isSaving,
  lastSavedAt,
  hasUnsavedChanges,
  error = false,
  className
}) => {
  const getStatusContent = () => {
    if (error) {
      return (
        <>
          <CloudOff className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">Save failed - will retry</span>
        </>
      );
    }
    
    if (isSaving) {
      return (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      );
    }
    
    if (hasUnsavedChanges) {
      return (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-amber-600">Unsaved changes</span>
        </>
      );
    }
    
    if (lastSavedAt) {
      return (
        <>
          <Cloud className="h-3.5 w-3.5 text-green-600" />
          <span className="text-muted-foreground">
            Saved {format(lastSavedAt, 'h:mm a')}
          </span>
        </>
      );
    }
    
    return (
      <>
        <Check className="h-3.5 w-3.5 text-green-600" />
        <span className="text-muted-foreground">All changes saved</span>
      </>
    );
  };
  
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs font-medium",
      className
    )}>
      {getStatusContent()}
    </div>
  );
};
