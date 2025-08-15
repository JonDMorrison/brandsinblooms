import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = 'md'
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="
          fixed inset-0 z-50 bg-[rgba(6,10,12,0.72)]
          backdrop-blur-sm data-[state=open]:animate-fadeScaleIn
        " />
        
        {/* Panel */}
        <Dialog.Content className={cn(
          "glass grad-border shadow-elev-2 fixed left-1/2 top-1/2 z-50",
          "w-[92vw] -translate-x-1/2 -translate-y-1/2",
          "p-6 focus:outline-none data-[state=open]:animate-fadeScaleIn",
          sizeClasses[size],
          className
        )}>
          {/* Close Button */}
          <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-ink-2 hover:text-ink-1 hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>

          {/* Header */}
          {(title || description) && (
            <div className="mb-4">
              {title && (
                <Dialog.Title className="font-heading text-xl text-ink-1 pr-8">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="mt-2 text-sm text-ink-2">
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}

          {/* Content */}
          <div className="text-ink-1">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="mt-6 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Form controls for dark theme
export const ModalInput = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "w-full rounded-xl bg-white/6 text-ink-1 placeholder:text-ink-2/60",
      "ring-1 ring-white/10 focus:ring-white/25 focus:outline-none",
      "px-3 py-2 transition-all duration-200",
      className
    )}
    {...props}
  />
)

export const ModalTextarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "w-full rounded-xl bg-white/6 text-ink-1 placeholder:text-ink-2/60",
      "ring-1 ring-white/10 focus:ring-white/25 focus:outline-none",
      "px-3 py-2 transition-all duration-200 resize-none",
      className
    )}
    {...props}
  />
)

export const ModalSelect = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "w-full rounded-xl bg-white/6 text-ink-1",
      "ring-1 ring-white/10 focus:ring-white/25 focus:outline-none",
      "px-3 py-2 transition-all duration-200",
      className
    )}
    {...props}
  >
    {children}
  </select>
)

export const ModalLabel = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("block text-sm font-medium text-ink-1 mb-2", className)}
    {...props}
  />
)