
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
  
  // Updated primary colors using harmonious green palette
  primary: {
    DEFAULT: '#22C55E', // Fresh garden green that harmonizes with logo
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
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
    DEFAULT: '#22C55E', // Fresh garden green
    50: '#F0FDF4',
    100: '#DCFCE7',
    500: '#22C55E',
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
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },
  text: {
    primary: '#3E5A6B', // Brand steel-blue for headings
    secondary: '#475569',
    tertiary: '#64748B',
    inverse: '#FFFFFF',
  }
};
