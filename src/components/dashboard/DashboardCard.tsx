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
  variant?: 'default' | 'botanical';
  accent?: 'sage' | 'mint' | 'forest' | 'earth';
}

export const DashboardCard = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  status = 'ready',
  statusMessage,
  variant = 'default',
  accent = 'sage'
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

  const getVariantClasses = () => {
    if (variant === 'botanical') {
      const gradientClass = `botanical-gradient-${accent}`;
      const accentClass = accent !== 'sage' ? `botanical-accent-${accent}` : 'botanical-accent-sage';
      return `${gradientClass} ${accentClass}`;
    }
    return 'bg-white';
  };

  const getIconClasses = () => {
    return variant === 'botanical' 
      ? 'botanical-icon-badge' 
      : 'p-3 rounded-xl bg-white/50 backdrop-blur-sm';
  };

  return (
    <Card className={`relative overflow-hidden border border-gray-200/60 rounded-2xl transition-all duration-300 ease-out hover:shadow-[0px_8px_24px_rgba(34,197,94,0.15)] hover:-translate-y-1 active:scale-[0.98] active:shadow-[0px_2px_8px_rgba(0,0,0,0.08)] shadow-[0px_6px_20px_rgba(0,0,0,0.08)] card-interactive ${getVariantClasses()}`}>
      <CardContent className="p-7">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={getIconClasses()}>
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              {statusMessage && (
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className={`text-xs ${getStatusColor()}`}>
                    {statusMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <p className="text-gray-600 text-sm mb-8 leading-relaxed">
          {description}
        </p>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={primaryAction.onClick}
            className={`w-full group rounded-xl h-12 font-medium transition-all duration-200 ${
              variant === 'botanical' 
                ? 'bg-gradient-to-r from-brand-green to-brand-teal hover:from-green-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg' 
                : 'bg-white/80 hover:bg-white text-gray-900 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={secondaryAction.onClick}
              className="text-gray-600 hover:text-gray-900 h-10"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};