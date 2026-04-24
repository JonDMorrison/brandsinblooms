
import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  animated?: boolean;
  staggerDelay?: number;
  performance?: 'smooth' | 'fast';
}

const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ 
    className, 
    cols = { mobile: 1, tablet: 2, desktop: 3 },
    gap = { mobile: "gap-4", tablet: "gap-6", desktop: "gap-8" },
    animated = true,
    staggerDelay = 100,
    performance = 'smooth',
    children,
    ...props 
  }, ref) => {
    const isMobile = useIsMobile();
    
    const gridCols = {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6'
    };

    const mobileClass = gridCols[cols.mobile || 1];
    const tabletClass = cols.tablet ? `md:${gridCols[cols.tablet]}` : '';
    const desktopClass = cols.desktop ? `lg:${gridCols[cols.desktop]}` : '';

    const mobileGap = gap.mobile || "gap-4";
    const tabletGap = gap.tablet ? `md:${gap.tablet}` : '';
    const desktopGap = gap.desktop ? `lg:${gap.desktop}` : '';

    const performanceClass = performance === 'fast' ? 'will-change-transform' : '';

    return (
      <div
        ref={ref}
        className={cn(
          'grid transition-all duration-300 ease-apple',
          mobileClass,
          tabletClass,
          desktopClass,
          mobileGap,
          tabletGap,
          desktopGap,
          animated && 'apple-fade-in',
          performanceClass,
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => (
          <div 
            className={cn(
              animated && 'apple-slide-up',
              performance === 'smooth' && 'transition-all duration-300 ease-apple'
            )}
            style={animated ? { 
              animationDelay: `${(index * staggerDelay)}ms`,
              animationFillMode: 'backwards'
            } : {}}
          >
            {child}
          </div>
        ))}
      </div>
    )
  }
)
ResponsiveGrid.displayName = "ResponsiveGrid"

export { ResponsiveGrid }
