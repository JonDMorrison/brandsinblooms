
import type { Config } from "tailwindcss";

export const fontFamily: Config["theme"]["extend"]["fontFamily"] = {
  'sans': ['Quicksand', 'system-ui', 'sans-serif'],
  'quicksand': ['Quicksand', 'system-ui', 'sans-serif'],
};

export const fontSize: Config["theme"]["extend"]["fontSize"] = {
  'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
  'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
  'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px
  'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
  'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
  '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
  '5xl': ['3rem', { lineHeight: '1' }],           // 48px
  '6xl': ['3.75rem', { lineHeight: '1' }],        // 60px
};

export const fontWeight: Config["theme"]["extend"]["fontWeight"] = {
  'light': '300',
  'normal': '400',
  'medium': '500',
  'semibold': '600',
  'bold': '700',
};
