
import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { processLogoBackground } from "@/utils/backgroundRemoval";

interface LandingPageIconProps {
  icon?: LucideIcon;
  logo?: string;
  variant?: 'hero' | 'section' | 'feature';
  theme?: 'spring' | 'summer' | 'autumn' | 'winter' | 'neutral';
  className?: string;
  containerClassName?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}

const variantStyles = {
  hero: {
    container: "w-20 h-20 md:w-24 md:h-24",
    icon: "w-10 h-10 md:w-12 md:h-12"
  },
  section: {
    container: "w-16 h-16",
    icon: "w-8 h-8"
  },
  feature: {
    container: "w-12 h-12",
    icon: "w-6 h-6"
  }
};

const themeStyles = {
  spring: "bg-gradient-to-br from-green-100 via-emerald-50 to-lime-100 border-green-200 text-green-700 shadow-green-200/50",
  summer: "bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 border-orange-200 text-orange-700 shadow-orange-200/50",
  autumn: "bg-gradient-to-br from-amber-100 via-orange-50 to-red-100 border-amber-200 text-amber-700 shadow-amber-200/50",
  winter: "bg-gradient-to-br from-blue-100 via-slate-50 to-cyan-100 border-blue-200 text-blue-700 shadow-blue-200/50",
  neutral: "bg-gradient-to-br from-white via-gray-50 to-slate-100 border-gray-200 text-garden-green shadow-gray-200/50"
};

export const LandingPageIcon = ({ 
  icon: Icon, 
  logo,
  variant = 'section', 
  theme = 'neutral', 
  className, 
  containerClassName,
  animated = true,
  style
}: LandingPageIconProps) => {
  const styles = variantStyles[variant];
  const [processedLogo, setProcessedLogo] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Process logo to remove background when component mounts
  React.useEffect(() => {
    if (logo && !processedLogo && !isProcessing) {
      setIsProcessing(true);
      processLogoBackground(logo)
        .then(setProcessedLogo)
        .catch((error) => {
          console.error('Failed to process logo background:', error);
          // Fallback to original logo if processing fails
          setProcessedLogo(logo);
        })
        .finally(() => setIsProcessing(false));
    }
  }, [logo, processedLogo, isProcessing]);
  
  // Special handling for logos - no border, smaller size (50% of previous)
  if (logo) {
    const logoSize = variant === 'hero' ? 'w-30 h-30 md:w-36 md:h-36' : 
                     variant === 'section' ? 'w-12 h-12' : 'w-9 h-9';
    
    return (
      <div 
        className={cn(
          "flex items-center justify-center transition-all duration-300 ease-out",
          logoSize,
          animated && "hover:scale-110 hover:-translate-y-1",
          containerClassName
        )}
        style={style}
      >
        <img 
          src={processedLogo || logo}
          alt="BloomSuite Logo"
          className={cn(
            "transition-all duration-300 object-contain",
            logoSize,
            animated && "group-hover:scale-110",
            isProcessing && "opacity-50",
            className
          )}
        />
      </div>
    );
  }
  
  // Original icon handling
  return (
    <div 
      className={cn(
        "rounded-full border-2 shadow-lg flex items-center justify-center",
        "transition-all duration-300 ease-out",
        styles.container,
        themeStyles[theme],
        animated && "hover:scale-110 hover:shadow-xl hover:-translate-y-1",
        containerClassName
      )}
      style={style}
    >
      {Icon ? (
        <Icon 
          className={cn(
            "transition-all duration-300",
            styles.icon,
            animated && "group-hover:scale-110",
            className
          )}
        />
      ) : null}
    </div>
  );
};

export const ConnectedIcons = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) => {
  return (
    <div className={cn("relative", className)}>
      {/* Connecting line */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-garden-green/20 via-garden-green/40 to-garden-green/20 -translate-y-1/2 -z-10" />
      
      {/* Animated dots */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 -translate-y-1/2 -z-10 overflow-hidden">
        <div className="w-2 h-2 bg-garden-green rounded-full animate-pulse absolute -top-0.75 left-1/4 opacity-60" />
        <div className="w-1.5 h-1.5 bg-garden-green-light rounded-full animate-pulse absolute -top-0.5 left-3/4 opacity-40 delay-500" />
      </div>
      
      <div className="flex justify-between items-center relative z-10">
        {children}
      </div>
    </div>
  );
};
