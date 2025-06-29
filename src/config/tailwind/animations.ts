
import type { Config } from "tailwindcss";

export const keyframes: Config["theme"]["extend"]["keyframes"] = {
  'fade-in': {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  'slide-up': {
    '0%': { transform: 'translateY(10px)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
};

export const animation: Config["theme"]["extend"]["animation"] = {
  'fade-in': 'fade-in 0.2s ease-out',
  'slide-up': 'slide-up 0.3s ease-out',
};
