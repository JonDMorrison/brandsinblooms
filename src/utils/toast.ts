
// Global toast utility to replace missing toast implementations
// This creates a simple toast system that can be used throughout the app

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  variant?: 'default' | 'destructive' | 'success';
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Simple global toast implementation
const createToast = (message: string, options: ToastOptions = {}) => {
  // For now, we'll use console and alert as fallback
  // In production, this should integrate with a proper toast system
  const prefix = options.variant === 'destructive' ? '❌ ' : 
                 options.variant === 'success' ? '✅ ' : 'ℹ️ ';
  
  console.log(`${prefix}${options.title || 'Notification'}: ${message}`);
  
  // Create a simple DOM toast element
  const toast = document.createElement('div');
  toast.className = `
    fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm
    ${options.variant === 'destructive' ? 'bg-red-500 text-white' : 
      options.variant === 'success' ? 'bg-green-500 text-white' : 
      'bg-gray-800 text-white'}
  `;
  
  toast.innerHTML = `
    <div class="flex items-start gap-2">
      <div class="flex-1">
        ${options.title ? `<div class="font-medium">${options.title}</div>` : ''}
        <div class="text-sm">${message}</div>
      </div>
      <button class="text-white/80 hover:text-white" onclick="this.parentElement.parentElement.remove()">
        ×
      </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Auto remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, options.duration || 5000);
};

// Create main toast function with methods
const toastFunction = (message: string, options?: ToastOptions) => {
  return createToast(message, options);
};

// Add methods to the function
toastFunction.success = (message: string, options?: ToastOptions) => 
  createToast(message, { ...options, variant: 'success' });

toastFunction.error = (message: string, options?: ToastOptions) => 
  createToast(message, { ...options, variant: 'destructive' });

toastFunction.info = (message: string, options?: ToastOptions) => 
  createToast(message, { ...options, variant: 'default' });

// Export as toast
export const toast = toastFunction;

// Make toast available globally
(window as any).toast = toast;

// Export individual functions for direct import
export { createToast };
