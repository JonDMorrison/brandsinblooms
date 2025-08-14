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
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'setup-needed':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'setup-needed':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="glass grad-border shadow-elev-2 p-5 hover:shadow-glow transition-all duration-base ease-brand hover:-translate-y-0.5 animate-fadeScaleIn">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-grad-primary animate-pulse-glow flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="font-heading text-lg text-ink-1">{title}</h3>
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
      
      <p className="text-ink-2 mt-1 mb-6 leading-relaxed">
        {description}
      </p>
      
      <div className="flex gap-2">
        <button 
          className="btn-primary flex-1"
          onClick={primaryAction.onClick}
        >
          {primaryAction.label}
        </button>
        
        {secondaryAction && (
          <button 
            className="btn-ghost"
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};