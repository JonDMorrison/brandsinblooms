
import * as React from "react";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Instagram, 
  Mail, 
  MessageSquare, 
  Leaf,
  Sun,
  Droplets,
  Snowflake,
  Sparkles,
  CheckCircle2,
  Calendar,
  BarChart3
} from "lucide-react";

interface PremiumIconProps {
  icon: 'newsletter' | 'instagram' | 'email' | 'facebook' | 'leaf' | 'sun' | 'droplets' | 'snowflake' | 'sparkles' | 'check' | 'calendar' | 'analytics';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'seasonal';
}

const iconMap = {
  newsletter: FileText,
  instagram: Instagram,
  email: Mail,
  facebook: MessageSquare,
  leaf: Leaf,
  sun: Sun,
  droplets: Droplets,
  snowflake: Snowflake,
  sparkles: Sparkles,
  check: CheckCircle2,
  calendar: Calendar,
  analytics: BarChart3
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

export const PremiumIcon = ({ 
  icon, 
  className, 
  size = 'md', 
  variant = 'default' 
}: PremiumIconProps) => {
  const IconComponent = iconMap[icon];
  
  const variantClasses = {
    default: 'text-gray-600',
    gradient: 'text-garden-green',
    seasonal: getSeasonalColor(icon)
  };

  return (
    <IconComponent 
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    />
  );
};

function getSeasonalColor(icon: string): string {
  const month = new Date().getMonth() + 1;
  
  if (icon === 'sun' || (month >= 6 && month <= 8)) {
    return 'text-orange-500';
  } else if (icon === 'leaf' || (month >= 3 && month <= 5)) {
    return 'text-green-500';
  } else if (icon === 'droplets' || (month >= 9 && month <= 11)) {
    return 'text-amber-600';
  } else if (icon === 'snowflake' || (month >= 12 || month <= 2)) {
    return 'text-blue-500';
  }
  
  return 'text-garden-green';
}

export const SeasonalIndicator = ({ className }: { className?: string }) => {
  const month = new Date().getMonth() + 1;
  
  let season: 'spring' | 'summer' | 'fall' | 'winter';
  let icon: 'leaf' | 'sun' | 'droplets' | 'snowflake';
  
  if (month >= 3 && month <= 5) {
    season = 'spring';
    icon = 'leaf';
  } else if (month >= 6 && month <= 8) {
    season = 'summer';
    icon = 'sun';
  } else if (month >= 9 && month <= 11) {
    season = 'fall';
    icon = 'droplets';
  } else {
    season = 'winter';
    icon = 'snowflake';
  }

  return (
    <div className={cn(`seasonal-indicator ${season}`, className)}>
      <PremiumIcon icon={icon} size="sm" variant="seasonal" />
    </div>
  );
};
