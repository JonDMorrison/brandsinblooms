
import type { Config } from "tailwindcss";

export const boxShadow: Config["theme"]["extend"]["boxShadow"] = {
  'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

export const transitionTimingFunction: Config["theme"]["extend"]["transitionTimingFunction"] = {
  'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
};

export const transitionDuration: Config["theme"]["extend"]["transitionDuration"] = {
  '150': '150ms',
  '300': '300ms',
  '500': '500ms',
};
