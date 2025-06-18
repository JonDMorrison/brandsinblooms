
import * as React from "react"
import { cn } from "@/lib/utils"
import { AppleButton, AppleButtonProps } from "./apple-button"
import { Loader2 } from "lucide-react"

export interface EnhancedAppleButtonProps extends AppleButtonProps {
  loading?: boolean;
  iconAnimation?: 'bounce' | 'rotate' | 'none';
  pulseOnHover?: boolean;
  rippleEffect?: boolean;
  feedback?: 'haptic' | 'visual' | 'both' | 'none';
}

const EnhancedAppleButton = React.forwardRef<HTMLButtonElement, EnhancedAppleButtonProps>(
  ({ 
    className, 
    children, 
    loading = false,
    iconAnimation = 'none',
    pulseOnHover = false,
    rippleEffect = true,
    feedback = 'visual',
    disabled,
    onClick,
    ...props 
  }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const iconClasses = {
      bounce: 'apple-icon-bounce',
      rotate: 'apple-icon-rotate',
      none: ''
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (rippleEffect && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const newRipple = { id: Date.now(), x, y };
        setRipples(prev => [...prev, newRipple]);
        
        // Remove ripple after animation
        setTimeout(() => {
          setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
        }, 600);
      }

      // Visual feedback
      if (feedback === 'visual' || feedback === 'both') {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 150);
      }

      // Haptic feedback (if supported)
      if ((feedback === 'haptic' || feedback === 'both') && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <AppleButton
        ref={(node) => {
          if (ref) {
            if (typeof ref === 'function') ref(node);
            else ref.current = node;
          }
          buttonRef.current = node;
        }}
        className={cn(
          'apple-button-press relative overflow-hidden',
          'apple-focus-ring',
          pulseOnHover && 'hover:animate-[gentle-pulse_1s_ease-in-out_infinite]',
          iconClasses[iconAnimation],
          isPressed && 'transform scale-95',
          'transition-all duration-150 ease-apple',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        )}
        
        {children}
        
        {/* Ripple Effect */}
        {rippleEffect && (
          <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
            {ripples.map((ripple) => (
              <span
                key={ripple.id}
                className="absolute bg-white/30 rounded-full animate-[ripple_0.6s_ease-out]"
                style={{
                  left: ripple.x - 10,
                  top: ripple.y - 10,
                  width: 20,
                  height: 20,
                }}
              />
            ))}
          </div>
        )}
      </AppleButton>
    )
  }
)
EnhancedAppleButton.displayName = "EnhancedAppleButton"

export { EnhancedAppleButton }
