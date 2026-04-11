type ToastOptions = {
  id?: string;
  [key: string]: any;
};

type ToastPromiseOptions = {
  loading: string;
  success: string | (() => string);
  error: string;
};

type ToastShim = {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  loading: (message: string, options?: ToastOptions) => void;
  dismiss: (id?: string) => void;
  promise: <T>(promise: Promise<T>, options: ToastPromiseOptions) => Promise<T>;
  custom: (component: any, options?: ToastOptions) => void;
};

declare global {
  var toast: ToastShim;

  interface Window {
    toast: ToastShim;
  }
}

const noop = () => {};

const toastShim: ToastShim = {
  success: noop,
  error: (message) => {
    console.error(message);
  },
  info: noop,
  warning: noop,
  loading: noop,
  dismiss: noop,
  promise: async <T>(promise: Promise<T>, options: ToastPromiseOptions) => {
    try {
      return await promise;
    } catch (error) {
      console.error(options.error);
      throw error;
    }
  },
  custom: noop,
};

globalThis.toast = globalThis.toast || toastShim;

export {};
