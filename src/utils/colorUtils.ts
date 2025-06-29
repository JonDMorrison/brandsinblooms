
/**
 * Clean brand color utilities - no unwanted colors
 */

export const BRAND_COLORS = {
  steelBlue: '#3E5A6B',
  tealMint: '#68BEB9',
  neutral: {
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
  }
};

/**
 * Get appropriate status color (clean brand palette only)
 */
export const getStatusColor = (status: string) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    review: 'bg-slate-100 text-slate-800 border-slate-200',
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
    posted: 'bg-brand/10 text-[#3E5A6B] border-brand/20',
    approved: 'bg-brand/10 text-[#3E5A6B] border-brand/20',
    pending: 'bg-blue-100 text-blue-800 border-blue-200',
    generating: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-brand/10 text-[#3E5A6B] border-brand/20',
    published: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200';
};

/**
 * Clean a className string of any unwanted color references
 */
export const cleanUnwantedColorsFromClassName = (className: string): string => {
  return className
    .replace(/bg-blue-700/g, 'bg-brand')
    .replace(/bg-blue-800/g, 'bg-brand')
    .replace(/text-yellow-400/g, 'text-[#3E5A6B]')
    .replace(/border-fuchsia-500/g, 'border-slate-200')
    .replace(/border-purple-500/g, 'border-slate-200')
    .replace(/border-pink-500/g, 'border-slate-200')
    .replace(/ring-orange-500/g, 'ring-brand')
    .replace(/yellow-\d+/g, 'slate-500')
    .replace(/amber-\d+/g, 'slate-500')
    .replace(/orange-\d+/g, 'slate-500')
    .replace(/purple-\d+/g, 'slate-500')
    .replace(/pink-\d+/g, 'slate-500')
    .replace(/fuchsia-\d+/g, 'slate-500')
    .replace(/\.debug-outline/g, '')
    .replace(/\.dev-border/g, '');
};
