// Utility for consistent toast usage across the app
export const showToast = {
  success: (message: string) => console.log(`SUCCESS: ${message}`),
  error: (message: string) => console.error(`ERROR: ${message}`),
  info: (message: string) => console.info(`INFO: ${message}`),
  warning: (message: string) => console.warn(`WARNING: ${message}`),
  loading: (message: string) => console.log(`LOADING: ${message}`),
};