// Global toast replacement for all files
// This replaces all sonner toast calls with console logs

declare global {
  var toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
    loading: (message: string, options?: any) => void;
    dismiss: (id?: string) => void;
  };
}

// Replace toast functionality with console logging
if (typeof window !== 'undefined') {
  window.toast = {
    success: (message: string) => console.log(`✅ SUCCESS: ${message}`),
    error: (message: string) => console.error(`❌ ERROR: ${message}`),
    info: (message: string) => console.info(`ℹ️ INFO: ${message}`),
    warning: (message: string) => console.warn(`⚠️ WARNING: ${message}`),
    loading: (message: string, options?: any) => console.log(`🔄 LOADING: ${message}`),
    dismiss: (id?: string) => console.log(`🗑️ DISMISS: ${id || 'all'}`),
  };
}

export {};