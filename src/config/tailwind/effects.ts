
import type { Config } from "tailwindcss";

export const boxShadow: Config["theme"]["extend"]["boxShadow"] = {
  'brand': '0 4px 6px -1px rgba(104, 190, 185, 0.1), 0 2px 4px -1px rgba(104, 190, 185, 0.06)',
  'brand-lg': '0 10px 15px -3px rgba(104, 190, 185, 0.1), 0 4px 6px -2px rgba(104, 190, 185, 0.05)',
};

export const transitionTimingFunction: Config["theme"]["extend"]["transitionTimingFunction"] = {
  'ease-apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
};

export const transitionDuration: Config["theme"]["extend"]["transitionDuration"] = {
  '400': '400ms',
  '600': '600ms',
};
