import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertCircle, CheckCircle } from "lucide-react";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  primaryAction: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  status?: 'ready' | 'setup-needed' | 'connected';
  statusMessage?: string;
  gradient?: string;
}

export const DashboardCard = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  status = 'ready',
  statusMessage,
  gradient = "from-blue-50 to-indigo-50"
}: DashboardCardProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 botanical-accent" />;
      case 'setup-needed':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'botanical-accent';
      case 'setup-needed':
        return 'text-amber-600';
      default:
        return 'botanical-muted';
    }
  };

  return (
    <Card className="glass-card rounded-2xl border-0 relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl glass botanical-accent-bg">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold botanical-heading">{title}</h3>
              {statusMessage && (
                <div className="flex items-center gap-1 mt-1">
                  {getStatusIcon()}
                  <span className={`text-xs ${getStatusColor()}`}>
                    {statusMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="botanical-text text-sm mb-6 leading-relaxed">
          {description}
        </p>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={primaryAction.onClick}
            className="w-full group botanical-button-primary rounded-xl"
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={secondaryAction.onClick}
              className="botanical-muted hover:botanical-text rounded-xl"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};