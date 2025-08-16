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
    <Card className={`relative overflow-hidden bg-white border border-gray-200 rounded-2xl transition-all duration-300 ease-out hover:shadow-[0px_6px_16px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:scale-[0.98] active:shadow-[0px_2px_8px_rgba(0,0,0,0.08)] shadow-[0px_4px_12px_rgba(0,0,0,0.08)] card-interactive`}>
      <CardContent className="p-7">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/50 backdrop-blur-sm">
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
            variant="outline"
            className="w-full group bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded-xl h-12 shadow-sm hover:shadow-md transition-all duration-200"
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={secondaryAction.onClick}
              className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 h-10 transition-colors duration-200"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};