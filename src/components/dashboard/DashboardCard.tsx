import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertCircle, CheckCircle } from "lucide-react";
import { getCardIllustration } from "./illustrations/BackgroundIllustrations";

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
  status?: 'ready' | 'setup-needed' | 'connected' | 'active' | 'pending' | 'inactive';
  statusMessage?: string;
  variant?: 'default' | 'botanical';
  accent?: 'sage' | 'mint' | 'forest' | 'earth';
  cardId?: string;
  accentIllustration?: ReactNode;
  dynamicIcon?: ReactNode;
  hasPendingAction?: boolean;
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
  accent = 'sage',
  cardId,
  accentIllustration,
  dynamicIcon,
  hasPendingAction = false
}: DashboardCardProps) => {
  const IllustrationComponent = cardId ? getCardIllustration(cardId) : null;
  const displayIcon = dynamicIcon || icon;
  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4" style={{ color: 'hsl(var(--brand-teal))' }} />;
      case 'setup-needed':
        return <AlertCircle className="w-4 h-4" style={{ color: 'hsl(var(--brand-navy))' }} />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
      case 'active':
        return 'text-[hsl(var(--brand-teal))]';
      case 'setup-needed':
      case 'inactive':
        return 'text-[hsl(var(--brand-navy))]';
      case 'pending':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  const getAccentBorderColor = () => {
    switch (status) {
      case 'connected':
      case 'active':
        return 'hover:border-[hsl(var(--brand-teal))]/30';
      case 'pending':
        return 'hover:border-amber-400/30';
      case 'setup-needed':
      case 'inactive':
        return 'hover:border-[hsl(var(--brand-navy))]/30';
      default:
        return 'hover:border-gray-300/50';
    }
  };

  const getVariantClasses = () => {
    return 'bg-white';
  };

  const getIconClasses = () => {
    return 'p-3 rounded-xl bg-white/50 backdrop-blur-sm';
  };

  return (
    <Card className={`relative overflow-hidden border border-gray-200/60 rounded-2xl transition-all duration-300 ease-out hover:shadow-[0px_8px_24px_rgba(34,197,94,0.15)] hover:-translate-y-1 active:scale-[0.98] active:shadow-[0px_2px_8px_rgba(0,0,0,0.08)] shadow-[0px_6px_20px_rgba(0,0,0,0.08)] card-interactive group ${getVariantClasses()} ${getAccentBorderColor()}`}>
      
      {/* Background Illustration */}
      {IllustrationComponent && (
        <div className="absolute inset-0 text-[hsl(var(--brand-teal))] transition-opacity duration-300 group-hover:opacity-[0.15] pointer-events-none">
          <IllustrationComponent className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </div>
      )}
      
      {/* Custom accent illustration */}
      {accentIllustration && (
        <div className="absolute bottom-0 right-0 opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.15] pointer-events-none text-[hsl(var(--brand-teal))]">
          {accentIllustration}
        </div>
      )}

      <CardContent className="relative p-7 z-10">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`${getIconClasses()} transition-transform duration-200 ${hasPendingAction ? 'animate-pulse' : ''}`}>
              {displayIcon}
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
              hasPendingAction ? 'animate-pulse-mint' : ''
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