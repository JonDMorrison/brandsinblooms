
import type { Config } from "tailwindcss";

export const colors: Config["theme"]["extend"]["colors"] = {
  border: 'rgb(var(--border))',
  input: 'rgb(var(--input))',
  ring: 'rgb(var(--ring))',
  background: 'rgb(var(--background))',
  foreground: 'rgb(var(--foreground))',
  
  // Enhanced Brand Colors - New token system
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
  
  // Status Chip Color System
  'chip': {
    draft: 'rgb(var(--chip-draft))',      // #9CA3AF
    generated: 'rgb(var(--chip-generated))', // #3B82F6
    approved: 'rgb(var(--chip-approved))',   // #22C55E
    scheduled: 'rgb(var(--chip-scheduled))', // #FBBF24
    posted: 'rgb(var(--chip-posted))',       // #10B981
  },
  
  // COMPLETELY OVERRIDE YELLOW/AMBER WITH GARDEN GREEN AND ORANGE
  yellow: {
    50: '#E8F5E8',    // Garden green very light
    100: '#C8E6C9',   // Garden green light
    200: '#A5D6A7',   // Garden green lighter
    300: '#81C784',   // Garden green medium light
    400: '#66BB6A',   // Garden green medium
    500: '#4CAF50',   // Garden green primary
    600: '#43A047',   // Garden green medium dark
    700: '#388E3C',   // Garden green dark
    800: '#2E7D32',   // Garden green darker
    900: '#1B5E20',   // Garden green darkest
  },
  amber: {
    50: '#FFF3E0',    // Orange very light for warnings
    100: '#FFE0B2',   // Orange light
    200: '#FFCC80',   // Orange lighter
    300: '#FFB74D',   // Orange medium light
    400: '#FFA726',   // Orange medium
    500: '#FF9800',   // Orange primary
    600: '#FB8C00',   // Orange medium dark
    700: '#F57C00',   // Orange dark
    800: '#EF6C00',   // Orange darker
    900: '#E65100',   // Orange darkest
  },
  
  // ADD GARDEN GREEN COLOR SYSTEM
  'garden-green': {
    DEFAULT: '#4CAF50',
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50',
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
    'light': '#81C784',
    'dark': '#2E7D32'
  },
  'garden-green-dark': '#2E7D32',
  'garden-green-light': '#81C784',
  'garden-background': '#F8FAF8',
  'garden-sage': '#F0F4F0',
  
  primary: {
    DEFAULT: '#4CAF50', // Garden green instead of yellow
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50',
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
    foreground: '#FFFFFF'
  },
  secondary: {
    DEFAULT: '#F5F5F5',
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
    foreground: '#000000'
  },
  success: {
    DEFAULT: '#4CAF50',
    50: '#E8F5E8',
    100: '#C8E6C9',
    500: '#4CAF50',
    600: '#43A047',
    foreground: '#FFFFFF'
  },
  warning: {
    DEFAULT: '#FF9800', // Orange for warnings instead of yellow
    50: '#FFF3E0',
    100: '#FFE0B2',
    500: '#FF9800',
    600: '#F57C00',
    foreground: '#FFFFFF'
  },
  destructive: {
    DEFAULT: '#F44336',
    50: '#FFEBEE',
    100: '#FFCDD2',
    500: '#F44336',
    600: '#E53935',
    foreground: '#FFFFFF'
  },
  muted: {
    DEFAULT: '#F5F5F5',
    50: '#FAFAFA',
    100: '#F5F5F5',
    foreground: '#757575'
  },
  accent: {
    DEFAULT: '#4CAF50', // Garden green instead of blue
    50: '#E8F5E8',
    100: '#C8E6C9',
    500: '#4CAF50',
    foreground: '#FFFFFF' // White text on green
  },
  popover: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000'
  },
  card: {
    DEFAULT: '#FFFFFF',
    foreground: '#000000'
  },
  // Semantic color system
  surface: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#F1F3F4',
  },
  text: {
    primary: '#202124',
    secondary: '#5F6368',
    tertiary: '#9AA0A6',
    inverse: '#FFFFFF',
  }
};
