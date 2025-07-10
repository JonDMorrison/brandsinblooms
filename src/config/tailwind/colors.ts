
import type { Config } from "tailwindcss";

export const colors: Config["theme"]["extend"]["colors"] = {
  // Core System Colors
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  
  // Simplified Brand Palette
  primary: {
    DEFAULT: '#68BEB9', // Brand Teal - Primary actions, selections, highlights
    50: '#F0FFFE',
    100: '#E1FFFE', 
    500: '#68BEB9',
    600: '#5AA8A3',
    700: '#4C928D',
    foreground: '#FFFFFF'
  },
  
  secondary: {
    DEFAULT: '#3E5A6B', // Brand Steel Blue - Headings, important text
    50: '#F8FAFC',
    100: '#F1F5F9',
    500: '#3E5A6B',
    600: '#354F5F',
    700: '#2C4253',
    foreground: '#FFFFFF'
  },
  
  // Neutral Gray Scale (Only what we need)
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9', 
    200: '#E2E8F0',
    300: '#CBD5E1',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A'
  },
  
  // Semantic Colors (Minimal)
  destructive: {
    DEFAULT: '#DC2626', // Red for destructive actions only
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#DC2626',
    600: '#B91C1C',
    foreground: '#FFFFFF'
  },
  
  success: {
    DEFAULT: '#68BEB9', // Use primary teal for success
    50: '#F0FFFE',
    100: '#E1FFFE',
    500: '#68BEB9',
    foreground: '#FFFFFF'
  },
  
  // Simplified Status System
  muted: {
    DEFAULT: '#F1F5F9',
    foreground: '#64748B'
  },
  
  accent: {
    DEFAULT: '#68BEB9', // Same as primary
    foreground: '#FFFFFF'
  },
  
  popover: {
    DEFAULT: '#FFFFFF',
    foreground: '#334155'
  },
  
  card: {
    DEFAULT: '#FFFFFF',
    foreground: '#334155'
  },
  
  // Clean surface system
  surface: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC', 
    tertiary: '#F1F5F9'
  },
  
  // Typography colors
  text: {
    primary: '#3E5A6B',   // Brand steel-blue for headings
    secondary: '#475569', // Medium gray for body text
    tertiary: '#64748B',  // Light gray for muted text
    inverse: '#FFFFFF'
  },
  
  // Remove all problematic colors by mapping to safe alternatives
  yellow: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' },
  amber: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' },
  orange: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' },
  purple: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' },
  pink: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' },
  fuchsia: { 50: '#F8FAFC', 100: '#F1F5F9', 500: '#64748B', 600: '#475569' }
};
