import * as React from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastObject = {
  id?: string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction | React.ReactNode;
};

type ToastInput = React.ReactNode | ToastObject;

type ToastCallOptions = Omit<ExternalToast, "id" | "description" | "action"> & {
  id?: string | number;
  description?: React.ReactNode;
  variant?: ToastVariant;
  action?: ToastAction | React.ReactNode;
};

type ToastController = {
  id: string | number;
  dismiss: () => void;
  update: (input: ToastInput, options?: ToastCallOptions) => void;
};

type ToastPromiseOptions<T> = {
  loading: React.ReactNode;
  success: React.ReactNode | ((value: T) => React.ReactNode);
  error: React.ReactNode | ((error: unknown) => React.ReactNode);
};

type ToastFn = {
  (input: ToastInput, options?: ToastCallOptions): ToastController;
  success: (input: ToastInput, options?: ToastCallOptions) => ToastController;
  error: (input: ToastInput, options?: ToastCallOptions) => ToastController;
  info: (input: ToastInput, options?: ToastCallOptions) => ToastController;
  warning: (input: ToastInput, options?: ToastCallOptions) => ToastController;
  loading: (input: ToastInput, options?: ToastCallOptions) => ToastController;
  dismiss: (id?: string | number) => void;
  promise: <T>(
    promise: Promise<T>,
    options: ToastPromiseOptions<T>,
  ) => Promise<T>;
  custom: typeof sonnerToast.custom;
};

const EMPTY_TOASTS: Array<never> = [];

const isToastObject = (value: ToastInput): value is ToastObject =>
  typeof value === "object" && value !== null && !React.isValidElement(value);

const normalizeAction = (
  action?: ToastAction | React.ReactNode,
): ExternalToast["action"] | undefined => {
  if (!action || React.isValidElement(action)) {
    return undefined;
  }

  if (typeof action === "object" && "label" in action && "onClick" in action) {
    return {
      label: action.label,
      onClick: action.onClick,
    };
  }

  return undefined;
};

const normalizeToast = (
  input: ToastInput,
  options?: ToastCallOptions,
  fallbackVariant: ToastVariant = "default",
) => {
  if (isToastObject(input)) {
    const { title, description, variant, action, ...restInput } = input;

    return {
      message: title ?? description ?? "Notification",
      options: {
        ...restInput,
        ...options,
        description: options?.description ?? description,
        action: normalizeAction(options?.action ?? action),
      } satisfies ToastCallOptions,
      variant: options?.variant ?? variant ?? fallbackVariant,
    };
  }

  return {
    message: input,
    options: {
      ...options,
      action: normalizeAction(options?.action),
    } satisfies ToastCallOptions,
    variant: options?.variant ?? fallbackVariant,
  };
};

const showToast = (
  variant: ToastVariant,
  input: ToastInput,
  options?: ToastCallOptions,
): ToastController => {
  const normalized = normalizeToast(input, options, variant);
  const { id, ...toastOptions } = normalized.options;
  const resolvedVariant = normalized.variant;

  const toastId =
    resolvedVariant === "success"
      ? sonnerToast.success(normalized.message, { ...toastOptions, id })
      : resolvedVariant === "destructive"
        ? sonnerToast.error(normalized.message, { ...toastOptions, id })
        : resolvedVariant === "warning"
          ? sonnerToast.warning(normalized.message, { ...toastOptions, id })
          : resolvedVariant === "info"
            ? sonnerToast.info(normalized.message, { ...toastOptions, id })
            : sonnerToast(normalized.message, { ...toastOptions, id });

  return {
    id: toastId,
    dismiss: () => sonnerToast.dismiss(toastId),
    update: (nextInput, nextOptions) => {
      showToast(resolvedVariant, nextInput, { ...nextOptions, id: toastId });
    },
  };
};

const toast = ((input: ToastInput, options?: ToastCallOptions) =>
  showToast("default", input, options)) as ToastFn;

toast.success = (input, options) => showToast("success", input, options);
toast.error = (input, options) => showToast("destructive", input, options);
toast.info = (input, options) => showToast("info", input, options);
toast.warning = (input, options) => showToast("warning", input, options);
toast.loading = (input, options) => showToast("default", input, options);
toast.dismiss = (id?: string | number) => {
  sonnerToast.dismiss(id);
};
toast.promise = (promise, options) =>
  sonnerToast.promise(promise, {
    loading: options.loading,
    success: options.success,
    error: options.error,
  });
toast.custom = sonnerToast.custom;

function useToast() {
  return React.useMemo(
    () => ({
      toasts: EMPTY_TOASTS,
      toast,
      dismiss: toast.dismiss,
    }),
    [],
  );
}

export { useToast, toast };
