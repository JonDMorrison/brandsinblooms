import { toast } from "@/hooks/use-toast";

type ToastShim = typeof toast;

declare global {
  var toast: ToastShim;

  interface Window {
    toast: ToastShim;
  }
}

globalThis.toast = toast;

export {};
