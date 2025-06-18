
import type { Config } from "tailwindcss";

export const spacing: Config["theme"]["extend"]["spacing"] = {
  '1': '0.25rem',   // 4px
  '2': '0.5rem',    // 8px
  '3': '0.75rem',   // 12px
  '4': '1rem',      // 16px
  '6': '1.5rem',    // 24px - Standard grid gap
  '8': '2rem',      // 32px
  '12': '3rem',     // 48px
  '16': '4rem',     // 64px
  '20': '5rem',     // 80px
  '24': '6rem',     // 96px - Large sections
  // Grid system specific spacing
  'grid-gap': '1.5rem', // 24px - Standard grid gap
  'section-gap': '2rem', // 32px - Between major sections
};

export const borderRadius: Config["theme"]["extend"]["borderRadius"] = {
  'xs': '0.25rem',   // 4px
  'sm': '0.375rem',  // 6px
  'md': '0.5rem',    // 8px
  'lg': '0.75rem',   // 12px
  'xl': '1rem',      // 16px
  '2xl': '1.25rem',  // 20px
};
