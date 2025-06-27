
import type { Config } from "tailwindcss";

export const colors: Config["theme"]["extend"]["colors"] = {
  border: 'rgb(var(--border))',
  input: 'rgb(var(--input))',
  ring: 'rgb(var(--ring))',
  background: 'rgb(var(--background))',
  foreground: 'rgb(var(--foreground))',
  
  // Enhanced Brand Colors - Clean green and blue system
  'brand-green': {
    DEFAULT: 'rgb(var(--brand-green))',
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#22C55E', // Primary brand green
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },
  'brand-blue': {
    DEFAULT: 'rgb(var(--brand-blue))',
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#2563EB', // Primary brand blue
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
    900: '#1E3A8A',
  },
  
  // Status Chip Color System - Clean greens and blues only
  'chip': {
    draft: 'rgb(var(--chip-draft))',      // #9CA3AF (gray)
    generated: 'rgb(var(--chip-generated))', // #3B82F6 (blue)
    approved: 'rgb(var(--chip-approved))',   // #22C55E (green)
    scheduled: 'rgb(var(--chip-scheduled))', // #2563EB (blue instead of yellow)
    posted: 'rgb(var(--chip-posted))',       // #10B981 (green)
  },
  
  // COMPLETELY OVERRIDE YELLOW/AMBER/ORANGE/PURPLE WITH CLEAN ALTERNATIVES
  yellow: {
    50: '#F8FAFC',    // Light gray instead of yellow
    100: '#F1F5F9',   // Light gray
    200: '#E2E8F0',   // Light gray
    300: '#CBD5E1',   // Medium gray
    400: '#94A3B8',   // Medium gray
    500: '#64748B',   // Slate gray
    600: '#475569',   // Dark gray
    700: '#334155',   // Darker gray
    800: '#1E293B',   // Very dark gray
    900: '#0F172A',   // Almost black
  },
  amber: {
    50: '#F8FAFC',    // Light gray instead of amber
    100: '#F1F5F9',   // Light gray
    200: '#E2E8F0',   // Light gray
    300: '#CBD5E1',   // Medium gray
    400: '#94A3B8',   // Medium gray
    500: '#64748B',   // Slate gray
    600: '#475569',   // Dark gray
    700: '#334155',   // Darker gray
    800: '#1E293B',   // Very dark gray
    900: '#0F172A',   // Almost black
  },
  orange: {
    50: '#F8FAFC',    // Light gray instead of orange
    100: '#F1F5F9',   // Light gray
    200: '#E2E8F0',   // Light gray
    300: '#CBD5E1',   // Medium gray
    400: '#94A3B8',   // Medium gray
    500: '#64748B',   // Slate gray
    600: '#475569',   // Dark gray
    700: '#334155',   // Darker gray
    800: '#1E293B',   // Very dark gray
    900: '#0F172A',   // Almost black
  },
  purple: {
    50: '#F8FAFC',    // Light gray instead of purple
    100: '#F1F5F9',   // Light gray
    200: '#E2E8F0',   // Light gray
    300: '#CBD5E1',   // Medium gray
    400: '#94A3B8',   // Medium gray
    500: '#64748B',   // Slate gray
    600: '#475569',   // Dark gray
    700: '#334155',   // Darker gray
    800: '#1E293B',   // Very dark gray
    900: '#0F172A',   // Almost black
  },
  pink: {
    50: '#F8FAFC',    // Light gray instead of pink/fuschia
    100: '#F1F5F9',   // Light gray
    200: '#E2E8F0',   // Light gray
    300: '#CBD5E1',   // Medium gray
    400: '#94A3B8',   // Medium gray
    500: '#64748B',   // Slate gray
    600: '#475569',   // Dark gray
    700: '#334155',   // Darker gray
    800: '#1E293B',   // Very dark gray
    900: '#0F172A',   // Almost black
  },
  
  // Garden green system - primary brand color
  'garden-green': {
    DEFAULT: '#22C55E',
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    'light': '#81C784',
    'dark': '#166534'
  },
  'garden-green-dark': '#166534',
  'garden-green-light': '#81C784',
  'garden-background': '#F8FAF8',
  'garden-sage': '#F0F4F0',
  
  primary: {
    DEFAULT: '#22C55E', // Garden green
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
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
    DEFAULT: '#22C55E',
    50: '#E8F5E8',
    100: '#C8E6C9',
    500: '#22C55E',
    600: '#16A34A',
    foreground: '#FFFFFF'
  },
  warning: {
    DEFAULT: '#64748B', // Slate gray for warnings instead of orange
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
    DEFAULT: '#22C55E', // Garden green
    50: '#E8F5E8',
    100: '#C8E6C9',
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
  // Semantic color system - clean grays and greens
  surface: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#64748B',
    inverse: '#FFFFFF',
  }
};
