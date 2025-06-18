
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse';
  className?: string;
  text?: string;
  color?: 'primary' | 'secondary' | 'muted';
}

export const LoadingSpinner = ({ 
  size = 'md', 
  variant = 'default',
  className, 
  text,
  color = 'primary'
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary-foreground',
    muted: 'text-muted-foreground'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  if (variant === 'dots') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={cn(
                'rounded-full bg-current',
                sizeClasses[size],
                colorClasses[color],
                'animate-pulse'
              )}
              style={{
                animationDelay: `${index * 0.2}s`,
                animationDuration: '1.4s'
              }}
            />
          ))}
        </div>
        {text && (
          <p className={cn(
            'text-muted-foreground apple-color-transition',
            textSizeClasses[size]
          )}>
            {text}
          </p>
        )}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
        <div 
          className={cn(
            'rounded-full bg-current animate-[gentle-pulse_2s_ease-in-out_infinite]',
            sizeClasses[size],
            colorClasses[color]
          )}
        />
        {text && (
          <p className={cn(
            'text-muted-foreground apple-color-transition',
            textSizeClasses[size]
          )}>
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 
        className={cn(
          'animate-spin transition-all duration-300 ease-apple',
          sizeClasses[size],
          colorClasses[color]
        )} 
      />
      {text && (
        <p className={cn(
          'text-muted-foreground apple-color-transition',
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );
};
