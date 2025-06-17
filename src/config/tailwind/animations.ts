
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
  }
};

export const animation: Config["theme"]["extend"]["animation"] = {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  'fade-in': 'fade-in 0.2s ease-out',
  'scale-in': 'scale-in 0.15s ease-out',
};
