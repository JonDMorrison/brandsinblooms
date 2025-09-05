
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
  
  // Core Palette - Dark Teal Primary
  primary: {
    DEFAULT: '#06495d', // Dark Teal (Primary)
    50: '#f0f9fb',
    100: '#d9f0f4',
    200: '#b7e2ea',
    300: '#86cdd9',
    400: '#4eb0c1',
    500: '#2c9da3', // Bright Teal (Secondary)
    600: '#06495d', // Dark Teal (Primary)
    700: '#053d4a',
    800: '#043137',
    900: '#032024',
    foreground: '#FFFFFF'
  },
  secondary: {
    DEFAULT: '#2c9da3', // Bright Teal (Secondary)
    50: '#f0f9fb',
    100: '#d9f0f4', 
    200: '#b7e2ea',
    300: '#86cdd9',
    400: '#4eb0c1',
    500: '#2c9da3', // Bright Teal (Secondary)
    600: '#24858a',
    700: '#1c6c71',
    800: '#145458',
    900: '#0c3b3f',
    foreground: '#FFFFFF'
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
    DEFAULT: '#2f3a75', // Deep Indigo (Accent / Depth)
    50: '#f4f5f9',
    100: '#e8eaf3',
    500: '#2f3a75', // Deep Indigo (Accent / Depth)
    600: '#252f5f',
    foreground: '#FFFFFF'
  },
  popover: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000'
  },
  card: {
    DEFAULT: '#fbfdfa', // Off-White (Background)
    foreground: '#2f3a75' // Deep Indigo text
  },
  
  // New Core Palette Colors
  'dark-teal': {
    DEFAULT: '#06495d',
    50: '#f0f9fb',
    500: '#06495d',
    600: '#053d4a',
  },
  'bright-teal': {
    DEFAULT: '#2c9da3',
    50: '#f0f9fb', 
    500: '#2c9da3',
    600: '#24858a',
  },
  'deep-indigo': {
    DEFAULT: '#2f3a75',
    50: '#f4f5f9',
    500: '#2f3a75',
    600: '#252f5f',
  },
  'offwhite': {
    DEFAULT: '#fbfdfa',
    50: '#fbfdfa',
  },
  'coolgray': {
    DEFAULT: '#a3aaaa',
    50: '#f7f8f8',
    500: '#a3aaaa',
  },
  'cta': {
    DEFAULT: '#2c9da3', // Updated to requested teal color
    50: '#f0f9fb',
    500: '#2c9da3',
    600: '#24858a',
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
