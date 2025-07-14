// Global toast replacement for all files
// This replaces all sonner toast calls with console logs

declare global {
  var toast: {
    success: (message: string, options?: any) => void;
    error: (message: string, options?: any) => void;
    info: (message: string, options?: any) => void;
    warning: (message: string, options?: any) => void;
    loading: (message: string, options?: any) => void;
    dismiss: (id?: string) => void;
    promise: (promise: Promise<any>, options: { loading: string; success: string | (() => string); error: string; }) => void;
    custom: (component: any, options?: any) => void;
  };
}

// Replace toast functionality with console logging
if (typeof window !== 'undefined') {
  window.toast = {
    success: (message: string, options?: any) => {
      console.log(`✅ SUCCESS: ${message}`);
      if (options?.description) console.log(`   Description: ${options.description}`);
    },
    error: (message: string, options?: any) => {
      console.error(`❌ ERROR: ${message}`);
      if (options?.description) console.error(`   Description: ${options.description}`);
    },
    info: (message: string, options?: any) => {
      console.info(`ℹ️ INFO: ${message}`);
      if (options?.description) console.info(`   Description: ${options.description}`);
    },
    warning: (message: string, options?: any) => {
      console.warn(`⚠️ WARNING: ${message}`);
      if (options?.description) console.warn(`   Description: ${options.description}`);
    },
    loading: (message: string, options?: any) => console.log(`🔄 LOADING: ${message}`),
    dismiss: (id?: string) => console.log(`🗑️ DISMISS: ${id || 'all'}`),
    promise: async (promise: Promise<any>, options: { loading: string; success: string | (() => string); error: string; }) => {
      console.log(`🔄 PROMISE LOADING: ${options.loading}`);
      try {
        const result = await promise;
        const successMsg = typeof options.success === 'function' ? options.success() : options.success;
        console.log(`✅ PROMISE SUCCESS: ${successMsg}`);
        return result;
      } catch (error) {
        console.error(`❌ PROMISE ERROR: ${options.error}`);
        throw error;
      }
    },
    custom: (component: any, options?: any) => {
      console.log(`🎨 CUSTOM TOAST: Component rendered`);
      if (options?.duration) console.log(`   Duration: ${options.duration}ms`);
    },
  };
}

export {};