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
    <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient} border border-gray-200 hover:shadow-lg transition-all duration-200 card-interactive`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/50 backdrop-blur-sm">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
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
        
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          {description}
        </p>
        
        <div className="flex flex-col gap-2">
          <Button 
            onClick={primaryAction.onClick}
            className="w-full group bg-white/80 hover:bg-white text-gray-900 border border-gray-200 hover:border-gray-300"
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={secondaryAction.onClick}
              className="text-gray-600 hover:text-gray-900"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};