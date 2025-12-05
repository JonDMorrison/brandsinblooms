import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const HeaderUsageIndicator = () => {
  const navigate = useNavigate();
  const { usage, loading, getThresholds } = useUsageTracking();

  if (loading || !usage) return null;

  const thresholds = getThresholds();

  const getColor = (percent: number, unlimited: boolean) => {
    if (unlimited) return 'text-primary';
    if (percent >= 100) return 'text-destructive';
    if (percent >= 80) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const getBgColor = (percent: number, unlimited: boolean) => {
    if (unlimited) return 'bg-primary/10';
    if (percent >= 100) return 'bg-destructive/10';
    if (percent >= 80) return 'bg-amber-100';
    return 'bg-muted/50';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/settings/usage')}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:bg-muted",
              thresholds.anyAt100 && "bg-destructive/10 hover:bg-destructive/20",
              thresholds.anyAt80 && !thresholds.anyAt100 && "bg-amber-100 hover:bg-amber-200"
            )}
          >
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded",
              getBgColor(usage.email.percent, usage.email.unlimited)
            )}>
              <Mail className={cn("h-3 w-3", getColor(usage.email.percent, usage.email.unlimited))} />
              <span className={getColor(usage.email.percent, usage.email.unlimited)}>
                {usage.email.unlimited ? '∞' : `${Math.round(usage.email.percent)}%`}
              </span>
            </div>
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded",
              getBgColor(usage.sms.percent, usage.sms.unlimited)
            )}>
              <MessageSquare className={cn("h-3 w-3", getColor(usage.sms.percent, usage.sms.unlimited))} />
              <span className={getColor(usage.sms.percent, usage.sms.unlimited)}>
                {usage.sms.unlimited ? '∞' : `${Math.round(usage.sms.percent)}%`}
              </span>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p>
              <strong>Email:</strong> {usage.email.used.toLocaleString()} / {usage.email.unlimited ? '∞' : usage.email.limit.toLocaleString()}
            </p>
            <p>
              <strong>SMS:</strong> {usage.sms.used.toLocaleString()} / {usage.sms.unlimited ? '∞' : usage.sms.limit.toLocaleString()}
            </p>
            <p className="text-muted-foreground pt-1">Click to view details</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
