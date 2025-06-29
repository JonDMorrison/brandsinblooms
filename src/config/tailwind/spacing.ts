
import type { Config } from "tailwindcss";

export const spacing: Config["theme"]["extend"]["spacing"] = {
  '18': '4.5rem',   // 72px
  '88': '22rem',    // 352px
  '100': '25rem',   // 400px
  '112': '28rem',   // 448px
  '128': '32rem',   // 512px
};

export const borderRadius: Config["theme"]["extend"]["borderRadius"] = {
  'xl': '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
};
