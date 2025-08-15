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
  variant?: 'sage' | 'mint' | 'cream' | 'forest' | 'lavender' | 'pearl' | 'moss';
}

export const DashboardCard = ({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  status = 'ready',
  statusMessage,
  variant = 'sage'
}: DashboardCardProps) => {
  const getVariantStyles = () => {
    const variants = {
      sage: {
        bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
        iconBg: 'bg-green-100/80',
        iconColor: 'text-green-700',
        titleColor: 'text-green-900',
        textColor: 'text-green-800',
        buttonBg: 'bg-green-600 hover:bg-green-700',
        border: 'border-green-100/50'
      },
      mint: {
        bg: 'bg-gradient-to-br from-teal-50 to-cyan-50',
        iconBg: 'bg-teal-100/80',
        iconColor: 'text-teal-700',
        titleColor: 'text-teal-900',
        textColor: 'text-teal-800',
        buttonBg: 'bg-teal-600 hover:bg-teal-700',
        border: 'border-teal-100/50'
      },
      cream: {
        bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
        iconBg: 'bg-amber-100/80',
        iconColor: 'text-amber-700',
        titleColor: 'text-amber-900',
        textColor: 'text-amber-800',
        buttonBg: 'bg-amber-600 hover:bg-amber-700',
        border: 'border-amber-100/50'
      },
      forest: {
        bg: 'bg-gradient-to-br from-emerald-100 to-green-100',
        iconBg: 'bg-white/90',
        iconColor: 'text-emerald-700',
        titleColor: 'text-white',
        textColor: 'text-emerald-50',
        buttonBg: 'bg-white/20 hover:bg-white/30 text-white border border-white/20',
        border: 'border-emerald-200/30'
      },
      lavender: {
        bg: 'bg-gradient-to-br from-purple-50 to-indigo-50',
        iconBg: 'bg-purple-100/80',
        iconColor: 'text-purple-700',
        titleColor: 'text-purple-900',
        textColor: 'text-purple-800',
        buttonBg: 'bg-purple-600 hover:bg-purple-700',
        border: 'border-purple-100/50'
      },
      pearl: {
        bg: 'bg-gradient-to-br from-slate-50 to-gray-50',
        iconBg: 'bg-slate-100/80',
        iconColor: 'text-slate-700',
        titleColor: 'text-slate-900',
        textColor: 'text-slate-700',
        buttonBg: 'bg-slate-600 hover:bg-slate-700',
        border: 'border-slate-100/50'
      },
      moss: {
        bg: 'bg-gradient-to-br from-lime-50 to-green-50',
        iconBg: 'bg-lime-100/80',
        iconColor: 'text-lime-700',
        titleColor: 'text-lime-900',
        textColor: 'text-lime-800',
        buttonBg: 'bg-lime-600 hover:bg-lime-700',
        border: 'border-lime-100/50'
      }
    };
    return variants[variant];
  };

  const styles = getVariantStyles();
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
    <Card className={`glass-card rounded-2xl border-0 relative overflow-hidden ${styles.bg} ${styles.border}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${styles.iconBg} backdrop-blur-sm`}>
              <div className={styles.iconColor}>
                {icon}
              </div>
            </div>
            <div>
              <h3 className={`font-semibold ${styles.titleColor}`}>{title}</h3>
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
        
        <p className={`${styles.textColor} text-sm mb-6 leading-relaxed`}>
          {description}
        </p>
        
        <div className="flex flex-col gap-3">
          <Button 
            onClick={primaryAction.onClick}
            className={`w-full group ${styles.buttonBg} text-white rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-300`}
          >
            {primaryAction.label}
            <ChevronRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
          
          {secondaryAction && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={secondaryAction.onClick}
              className={`${styles.textColor} hover:bg-white/50 rounded-xl`}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};