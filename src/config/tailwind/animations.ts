
import type { Config } from "tailwindcss";

export const keyframes: Config["theme"]["extend"]["keyframes"] = {
  'accordion-down': {
    from: {
      height: '0'
    },
    to: {
      height: 'var(--radix-accordion-content-height)'
    }
  },
  'accordion-up': {
    from: {
      height: 'var(--radix-accordion-content-height)'
    },
    to: {
      height: '0'
    }
  },
  'fade-in': {
    '0%': {
      opacity: '0',
      transform: 'translateY(4px)'
    },
    '100%': {
      opacity: '1',
      transform: 'translateY(0)'
    }
  },
  'scale-in': {
    '0%': {
      opacity: '0',
      transform: 'scale(0.98)'
    },
    '100%': {
      opacity: '1',
      transform: 'scale(1)'
    }
  },
  shimmer: {
    '0%': {
      transform: 'translateX(-100%)'
    },
    '100%': {
      transform: 'translateX(100%)'
    }
  },
  'gentle-pulse': {
    '0%': {
      opacity: '1'
    },
    '15%': {
      opacity: '0.5'
    },
    '30%': {
      opacity: '1'
    },
    '100%': {
      opacity: '1'
    }
  },
  'thinking-dot': {
    '0%, 80%, 100%': {
      transform: 'scale(0.8)',
      opacity: '0.5'
    },
    '40%': {
      transform: 'scale(1.2)',
      opacity: '1'
    }
  },
  'slide-in-left': {
    '0%': {
      opacity: '0',
      transform: 'translateX(-20px)'
    },
    '100%': {
      opacity: '1',
      transform: 'translateX(0)'
    }
  },
  'slide-in-right': {
    '0%': {
      opacity: '0',
      transform: 'translateX(20px)'
    },
    '100%': {
      opacity: '1',
      transform: 'translateX(0)'
    }
  },
  'slide-in-up': {
    '0%': {
      opacity: '0',
      transform: 'translateY(18px)'
    },
    '100%': {
      opacity: '1',
      transform: 'translateY(0)'
    }
  },
  'shimmer-fast': {
    '0%': {
      backgroundPosition: '-200% 0'
    },
    '100%': {
      backgroundPosition: '200% 0'
    }
  },
  'text-stream': {
    '0%': {
      opacity: '0',
      transform: 'translateY(2px)'
    },
    '100%': {
      opacity: '1',
      transform: 'translateY(0)'
    }
  }
};

export const animation: Config["theme"]["extend"]["animation"] = {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  'fade-in': 'fade-in 0.2s ease-out',
  'scale-in': 'scale-in 0.15s ease-out',
  shimmer: 'shimmer 2s infinite',
  'gentle-pulse': 'gentle-pulse 3s ease-in-out infinite',
  'thinking-dot': 'thinking-dot 1.4s ease-in-out infinite',
  'slide-in-left': 'slide-in-left 0.3s ease-out',
  'slide-in-right': 'slide-in-right 0.3s ease-out',
  'slide-in-up': 'slide-in-up 0.3s ease-out',
  'shimmer-fast': 'shimmer-fast 2s ease-in-out infinite',
  'text-stream': 'text-stream 0.3s ease-out',
};
