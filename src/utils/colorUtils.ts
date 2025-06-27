
/**
 * Universal color mapping utilities to eliminate yellow/amber/orange/purple from the entire application
 */

export const COLOR_MAPPINGS = {
  // Yellow to Gray mappings
  yellow: {
    50: '#F8FAFC',   // Light gray
    100: '#F1F5F9',  // Light gray
    200: '#E2E8F0',  // Light gray
    300: '#CBD5E1',  // Medium gray
    400: '#94A3B8',  // Medium gray
    500: '#64748B',  // Slate gray
    600: '#475569',  // Dark gray
    700: '#334155',  // Darker gray
    800: '#1E293B',  // Very dark gray
    900: '#0F172A',  // Almost black
  },
  
  // Amber to Gray mappings
  amber: {
    50: '#F8FAFC',   // Light gray
    100: '#F1F5F9',  // Light gray
    200: '#E2E8F0',  // Light gray
    300: '#CBD5E1',  // Medium gray
    400: '#94A3B8',  // Medium gray
    500: '#64748B',  // Slate gray
    600: '#475569',  // Dark gray
    700: '#334155',  // Darker gray
    800: '#1E293B',  // Very dark gray
    900: '#0F172A',  // Almost black
  },
  
  // Orange to Gray mappings
  orange: {
    50: '#F8FAFC',   // Light gray
    100: '#F1F5F9',  // Light gray
    200: '#E2E8F0',  // Light gray
    300: '#CBD5E1',  // Medium gray
    400: '#94A3B8',  // Medium gray
    500: '#64748B',  // Slate gray
    600: '#475569',  // Dark gray
    700: '#334155',  // Darker gray
    800: '#1E293B',  // Very dark gray
    900: '#0F172A',  // Almost black
  },
  
  // Purple to Gray mappings
  purple: {
    50: '#F8FAFC',   // Light gray
    100: '#F1F5F9',  // Light gray
    200: '#E2E8F0',  // Light gray
    300: '#CBD5E1',  // Medium gray
    400: '#94A3B8',  // Medium gray
    500: '#64748B',  // Slate gray
    600: '#475569',  // Dark gray
    700: '#334155',  // Darker gray
    800: '#1E293B',  // Very dark gray
    900: '#0F172A',  // Almost black
  }
};

type ColorShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

/**
 * Check if a string is a valid color shade
 */
const isValidColorShade = (shade: string): shade is ColorShade => {
  return ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].includes(shade);
};

/**
 * Convert unwanted colors to appropriate alternatives
 */
export const mapUnwantedColor = (color: string): string => {
  // Handle Tailwind class names for yellow/amber/orange/purple
  const unwantedColors = ['yellow', 'amber', 'orange', 'purple', 'pink', 'fuchsia'];
  
  for (const unwantedColor of unwantedColors) {
    if (color.startsWith(`${unwantedColor}-`)) {
      const shadeString = color.replace(`${unwantedColor}-`, '');
      if (isValidColorShade(shadeString)) {
        return COLOR_MAPPINGS.yellow[shadeString] || '#64748B'; // Default to slate
      }
      return '#64748B'; // Default slate gray
    }
  }
  
  // Handle hex values for unwanted colors
  const unwantedHexValues = [
    '#FBBC05', '#FDD835', '#FFEB3B', '#FFC107', '#FFD600', // Yellow
    '#F59E0B', '#D97706', '#FBBF24', // Amber
    '#FF9800', '#FB8C00', '#F57C00', '#EF6C00', '#E65100', // Orange
    '#9C27B0', '#8E24AA', '#7B1FA2', '#6A1B9A', '#4A148C', // Purple
    '#E91E63', '#C2185B', '#AD1457', '#880E4F', // Pink
  ];
  
  if (unwantedHexValues.includes(color.toUpperCase())) {
    return '#64748B'; // Slate gray
  }
  
  return color; // Return original if not unwanted color
};

/**
 * Get appropriate status color (no unwanted colors allowed)
 */
export const getStatusColor = (status: string) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    review: 'bg-slate-100 text-slate-800 border-slate-200', // Gray instead of orange
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',   // Blue instead of yellow
    posted: 'bg-green-100 text-green-800 border-green-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-blue-100 text-blue-800 border-blue-200',
    generating: 'bg-blue-100 text-blue-800 border-blue-200', // Blue instead of purple
    completed: 'bg-green-100 text-green-800 border-green-200',
    published: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
};

/**
 * Validate that no unwanted colors are being used
 */
export const validateNoUnwantedColors = (className: string): boolean => {
  const unwantedPatterns = [
    /yellow-\d+/, /amber-\d+/, /orange-\d+/, /purple-\d+/, /pink-\d+/, /fuchsia-\d+/,
    /bg-yellow/, /text-yellow/, /border-yellow/,
    /bg-amber/, /text-amber/, /border-amber/,
    /bg-orange/, /text-orange/, /border-orange/,
    /bg-purple/, /text-purple/, /border-purple/,
    /bg-pink/, /text-pink/, /border-pink/,
    /bg-fuchsia/, /text-fuchsia/, /border-fuchsia/,
  ];
  
  return !unwantedPatterns.some(pattern => pattern.test(className));
};

/**
 * Clean a className string of any unwanted color references
 */
export const cleanUnwantedColorsFromClassName = (className: string): string => {
  return className
    .replace(/yellow-\d+/g, 'slate-500')
    .replace(/amber-\d+/g, 'slate-500')
    .replace(/orange-\d+/g, 'slate-500')
    .replace(/purple-\d+/g, 'slate-500')
    .replace(/pink-\d+/g, 'slate-500')
    .replace(/fuchsia-\d+/g, 'slate-500')
    .replace(/bg-yellow/g, 'bg-slate')
    .replace(/text-yellow/g, 'text-slate')
    .replace(/border-yellow/g, 'border-slate')
    .replace(/bg-amber/g, 'bg-slate')
    .replace(/text-amber/g, 'text-slate')
    .replace(/border-amber/g, 'border-slate')
    .replace(/bg-orange/g, 'bg-slate')
    .replace(/text-orange/g, 'text-slate')
    .replace(/border-orange/g, 'border-slate')
    .replace(/bg-purple/g, 'bg-slate')
    .replace(/text-purple/g, 'text-slate')
    .replace(/border-purple/g, 'border-slate')
    .replace(/bg-pink/g, 'bg-slate')
    .replace(/text-pink/g, 'text-slate')
    .replace(/border-pink/g, 'border-slate')
    .replace(/bg-fuchsia/g, 'bg-slate')
    .replace(/text-fuchsia/g, 'text-slate')
    .replace(/border-fuchsia/g, 'border-slate');
};
