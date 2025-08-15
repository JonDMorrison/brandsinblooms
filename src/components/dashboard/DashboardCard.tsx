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
  gradient?: string; // Kept for compatibility but not used
}

export const DashboardCard = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  status = 'ready',
  statusMessage
}: DashboardCardProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 icon-green" />;
      case 'setup-needed':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'icon-green';
      case 'setup-needed':
        return 'text-amber-600';
      default:
        return 'text-secondary';
    }
  };

  return (
    <Card className="glass-card p-6">
      <CardContent className="p-0">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/20">
              {icon}
            </div>
            <div>
              <h3 className="text-primary font-semibold text-lg mb-1">{title}</h3>
              {statusMessage && (
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon()}
                  <span className={`text-sm ${getStatusColor()}`}>
                    {statusMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-secondary text-sm mb-8 leading-relaxed">
          {description}
        </p>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={primaryAction.onClick}
            className="btn-primary w-full group flex items-center justify-center gap-2"
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <button 
              onClick={secondaryAction.onClick}
              className="btn-secondary text-center"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};