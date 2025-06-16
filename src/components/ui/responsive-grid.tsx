
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
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  animated?: boolean;
}

const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ 
    className, 
    cols = { mobile: 1, tablet: 2, desktop: 3 },
    gap = { mobile: 4, tablet: 6, desktop: 8 },
    animated = true,
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

    const gridGaps = {
      2: 'gap-2',
      4: 'gap-4',
      6: 'gap-6',
      8: 'gap-8',
      12: 'gap-12'
    };

    const mobileClass = gridCols[cols.mobile || 1];
    const tabletClass = cols.tablet ? `md:${gridCols[cols.tablet]}` : '';
    const desktopClass = cols.desktop ? `lg:${gridCols[cols.desktop]}` : '';

    const mobileGap = gridGaps[gap.mobile || 4];
    const tabletGap = gap.tablet ? `md:${gridGaps[gap.tablet]}` : '';
    const desktopGap = gap.desktop ? `lg:${gridGaps[gap.desktop]}` : '';

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
