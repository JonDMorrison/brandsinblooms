// Utility for consistent toast usage across the app
export const showToast = {
  success: (message: string) => {},
  error: (message: string) => console.error(`ERROR: ${message}`),
  info: (message: string) => {},
  warning: (message: string) => {},
  loading: (message: string) => {},
};