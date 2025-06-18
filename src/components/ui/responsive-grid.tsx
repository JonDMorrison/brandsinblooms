
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
  useGridSystem?: boolean; // New prop for 12-column grid system
}

const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ 
    className, 
    cols = { mobile: 1, tablet: 2, desktop: 3 },
    gap = { mobile: "gap-4", tablet: "gap-6", desktop: "gap-6" },
    animated = true,
    useGridSystem = false,
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
      6: 'grid-cols-6',
      12: 'grid-cols-12'
    };

    // Use 12-column grid system when enabled
    if (useGridSystem) {
      return (
        <div
          ref={ref}
          className={cn(
            'grid grid-cols-12 gap-6', // Standard 24px gap for grid system
            animated && 'apple-fade-in',
            className
          )}
          {...props}
        >
          {React.Children.map(children, (child, index) => (
            <div 
              className={animated ? `apple-stagger-${Math.min(index + 1, 4)}` : ''}
              style={animated && index > 3 ? { animationDelay: `${(index + 1) * 0.1}s` } : {}}
            >
              {child}
            </div>
          ))}
        </div>
      );
    }

    // Legacy responsive grid behavior
    const mobileClass = gridCols[cols.mobile || 1];
    const tabletClass = cols.tablet ? `md:${gridCols[cols.tablet]}` : '';
    const desktopClass = cols.desktop ? `lg:${gridCols[cols.desktop]}` : '';

    const mobileGap = gap.mobile || 'gap-4';
    const tabletGap = gap.tablet ? `md:${gap.tablet}` : '';
    const desktopGap = gap.desktop ? `lg:${gap.desktop}` : '';

    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          mobileClass,
          tabletClass,
          desktopClass,
          mobileGap,
          tabletGap,
          desktopGap,
          animated && 'apple-fade-in',
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => (
          <div 
            className={animated ? `apple-stagger-${Math.min(index + 1, 4)}` : ''}
            style={animated && index > 3 ? { animationDelay: `${(index + 1) * 0.1}s` } : {}}
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
