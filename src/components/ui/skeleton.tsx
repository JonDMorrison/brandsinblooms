
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'text' | 'card';
  animation?: 'pulse' | 'wave' | 'none';
}

function Skeleton({
  className,
  variant = 'default',
  animation = 'wave',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded-sm h-4',
    card: 'rounded-lg h-32'
  };

  const animationClasses = {
    pulse: 'animate-pulse bg-gray-200 dark:bg-gray-700',
    wave: 'apple-skeleton bg-gray-200 dark:bg-gray-700',
    none: 'bg-gray-200 dark:bg-gray-700'
  };

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-apple",
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
