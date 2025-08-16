
import type { Config } from "tailwindcss";

export const colors: Config["theme"]["extend"]["colors"] = {
  border: 'rgb(var(--border))',
  input: 'rgb(var(--input))',
  ring: 'rgb(var(--ring))',
  background: 'rgb(var(--background))',
  foreground: 'rgb(var(--foreground))',
  
  // Clean Brand Colors
  'brand-steel-blue': {
    DEFAULT: '#3E5A6B',
    50: '#F0F2F4',
    100: '#E1E6EA',
    200: '#C3CDD5',
    300: '#A5B4C0',
    400: '#879BAB',
    500: '#3E5A6B', // Primary brand steel-blue
    600: '#354F5F',
    700: '#2C4253',
    800: '#233547',
    900: '#1A283B',
  },
  'brand-teal-mint': {
    DEFAULT: '#68BEB9',
    50: '#F0FFFE',
    100: '#E1FFFE',
    200: '#C3FFFC',
    300: '#A5FFFA',
    400: '#87DFD8',
    500: '#68BEB9', // Primary brand teal-mint
    600: '#5AA8A3',
    700: '#4C928D',
    800: '#3E7C77',
    900: '#306661',
  },
  
  // Status Chip Color System - Clean with brand colors
  'chip': {
    draft: 'rgb(var(--chip-draft))',      // #9CA3AF (gray)
    generated: 'rgb(var(--chip-generated))', // #3B82F6 (blue)
    approved: 'rgb(var(--chip-approved))',   // Brand teal-mint
    scheduled: 'rgb(var(--chip-scheduled))', // Blue
    posted: 'rgb(var(--chip-posted))',       // Brand teal-mint
  },
  
  // Neutralized color overrides - all set to clean alternatives
  yellow: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   // Slate gray
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  amber: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  orange: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  purple: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  pink: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  fuchsia: {
    50: '#F8FAFC',    // Light gray
    100: '#F1F5F9',   
    200: '#E2E8F0',   
    300: '#CBD5E1',   
    400: '#94A3B8',   
    500: '#64748B',   
    600: '#475569',   
    700: '#334155',   
    800: '#1E293B',   
    900: '#0F172A',   
  },
  
  // Updated primary colors using garden green
  primary: {
    DEFAULT: '#2E7D32', // Garden green for primary buttons
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#2E7D32',
    600: '#256628',
    700: '#1B5E20',
    800: '#2E7D32',
    900: '#1B5E20',
    foreground: '#FFFFFF'
  },
  secondary: {
    DEFAULT: '#F1F5F9',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    foreground: '#000000'
  },
  success: {
    DEFAULT: '#68BEB9',
    50: '#F0FFFE',
    100: '#E1FFFE',
    500: '#68BEB9',
    600: '#5AA8A3',
    foreground: '#FFFFFF'
  },
  warning: {
    DEFAULT: '#64748B', // Neutral slate instead of orange/yellow
    50: '#F8FAFC',
    100: '#F1F5F9',
    500: '#64748B',
    600: '#475569',
    foreground: '#FFFFFF'
  },
  destructive: {
    DEFAULT: '#DC2626', // Keep red for destructive actions
    50: '#FEF2F2',
    100: '#FEE2E2',
    500: '#DC2626',
    600: '#B91C1C',
    foreground: '#FFFFFF'
  },
  muted: {
    DEFAULT: '#F1F5F9',
    50: '#F8FAFC',
    100: '#F1F5F9',
    foreground: '#64748B'
  },
  accent: {
    DEFAULT: '#68BEB9', // Brand teal-mint
    50: '#F0FFFE',
    100: '#E1FFFE',
    500: '#68BEB9',
    foreground: '#FFFFFF'
  },
  popover: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000'
  },
  card: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000'
  },
  // Semantic color system - clean with brand colors
  surface: {
    primary: 'rgba(255, 255, 255, 0.95)', // Glass effect
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },
  text: {
    primary: '#1E1E1E', // High contrast headings
    secondary: '#475569', // Body text
    tertiary: '#64748B',
    inverse: '#FFFFFF',
  },
  // Dashboard card tints
  'card-tint': {
    content: 'rgba(244, 240, 255, 0.06)', // Soft lavender
    analytics: 'rgba(241, 245, 249, 0.06)', // Soft blue-gray
    campaign: 'rgba(240, 253, 244, 0.06)', // Soft green
  },
  // Icon accent colors
  'icon-accent': {
    newsletter: '#7C3AED', // Purple
    calendar: '#0EA5E9', // Blue
    analytics: '#059669', // Green
    social: '#DC2626', // Red
  }
};
