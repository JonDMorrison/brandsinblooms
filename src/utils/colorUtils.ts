
/**
 * Universal color mapping utilities to eliminate yellow/amber from the entire application
 */

export const COLOR_MAPPINGS = {
  // Yellow to Garden Green mappings
  yellow: {
    50: '#E8F5E8',   // Garden green very light
    100: '#C8E6C9',  // Garden green light
    200: '#A5D6A7',  // Garden green lighter
    300: '#81C784',  // Garden green medium light
    400: '#66BB6A',  // Garden green medium
    500: '#4CAF50',  // Garden green primary
    600: '#43A047',  // Garden green medium dark
    700: '#388E3C',  // Garden green dark
    800: '#2E7D32',  // Garden green darker
    900: '#1B5E20',  // Garden green darkest
  },
  
  // Amber to Orange mappings (for warnings)
  amber: {
    50: '#FFF3E0',   // Orange very light
    100: '#FFE0B2',  // Orange light
    200: '#FFCC80',  // Orange lighter
    300: '#FFB74D',  // Orange medium light
    400: '#FFA726',  // Orange medium
    500: '#FF9800',  // Orange primary
    600: '#FB8C00',  // Orange medium dark
    700: '#F57C00',  // Orange dark
    800: '#EF6C00',  // Orange darker
    900: '#E65100',  // Orange darkest
  }
};

/**
 * Convert yellow/amber color to appropriate alternative
 */
export const mapYellowColor = (color: string): string => {
  // Handle Tailwind class names
  if (color.startsWith('yellow-')) {
    const shade = color.replace('yellow-', '');
    return COLOR_MAPPINGS.yellow[shade as keyof typeof COLOR_MAPPINGS.yellow] || '#4CAF50';
  }
  
  if (color.startsWith('amber-')) {
    const shade = color.replace('amber-', '');
    return COLOR_MAPPINGS.amber[shade as keyof typeof COLOR_MAPPINGS.amber] || '#FF9800';
  }
  
  // Handle hex values
  const yellowHexValues = [
    '#FBBC05', '#FDD835', '#FFEB3B', '#FFC107', '#FFD600',
    '#F59E0B', '#D97706', '#FBBF24', '#F59E0B'
  ];
  
  if (yellowHexValues.includes(color.toUpperCase())) {
    return '#4CAF50'; // Garden green
  }
  
  return color; // Return original if not yellow/amber
};

/**
 * Get appropriate status color (no yellow allowed)
 */
export const getStatusColor = (status: string) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    review: 'bg-orange-100 text-orange-800 border-orange-200', // Orange for warnings
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',   // Blue instead of yellow
    posted: 'bg-green-100 text-green-800 border-green-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-blue-100 text-blue-800 border-blue-200',
    generating: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    published: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
};

/**
 * Validate that no yellow/amber colors are being used
 */
export const validateNoYellow = (className: string): boolean => {
  const yellowPatterns = [
    /yellow-\d+/,
    /amber-\d+/,
    /bg-yellow/,
    /text-yellow/,
    /border-yellow/,
    /bg-amber/,
    /text-amber/,
    /border-amber/,
  ];
  
  return !yellowPatterns.some(pattern => pattern.test(className));
};

/**
 * Clean a className string of any yellow/amber references
 */
export const cleanYellowFromClassName = (className: string): string => {
  return className
    .replace(/yellow-\d+/g, 'green-500')
    .replace(/amber-\d+/g, 'orange-500')
    .replace(/bg-yellow/g, 'bg-green')
    .replace(/text-yellow/g, 'text-green')
    .replace(/border-yellow/g, 'border-green')
    .replace(/bg-amber/g, 'bg-orange')
    .replace(/text-amber/g, 'text-orange')
    .replace(/border-amber/g, 'border-orange');
};
