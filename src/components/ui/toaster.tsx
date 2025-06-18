
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props} 
            className="!bg-white !border !border-gray-200 !text-gray-900 shadow-lg apple-slide-up backdrop-blur-sm"
          >
            <div className="grid gap-1">
              {title && (
                <ToastTitle className="!text-gray-900 font-medium apple-color-transition">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="!text-gray-600 apple-color-transition">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="apple-hover-subtle" />
          </Toast>
        )
      })}
      <ToastViewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
    </ToastProvider>
  )
}
