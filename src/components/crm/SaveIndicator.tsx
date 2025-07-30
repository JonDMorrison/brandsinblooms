import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveIndicatorProps {
  lastSaved?: Date;
  saving?: boolean;
  error?: boolean;
  className?: string;
  onRetry?: () => void;
}

export const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  lastSaved,
  saving = false,
  error = false,
  className,
  onRetry
}) => {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSaved && !saving && !error) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved, saving, error]);

  const getStatusText = () => {
    if (saving) return "Saving...";
    if (error) return "Error saving";
    if (showSaved) return "Saved";
    if (lastSaved) {
      const now = new Date();
      const diff = now.getTime() - lastSaved.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "Saved just now";
      if (minutes === 1) return "Saved 1 minute ago";
      return `Saved ${minutes} minutes ago`;
    }
    return "";
  };

  const getIcon = () => {
    if (saving) return <Loader2 className="h-3 w-3 animate-spin" />;
    if (error) return <AlertCircle className="h-3 w-3 text-red-500" />;
    if (showSaved || lastSaved) return <Check className="h-3 w-3 text-green-500" />;
    return null;
  };

  const statusText = getStatusText();
  if (!statusText) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs text-muted-foreground transition-all",
      saving && "text-blue-600",
      error && "text-red-600",
      showSaved && "text-green-600",
      className
    )}>
      {getIcon()}
      <span>{statusText}</span>
      {error && onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 text-xs underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
};