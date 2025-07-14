import React from 'react';
// Removed sonner import - using global toast replacement
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Info, XCircle, Undo2 } from 'lucide-react';

interface EnhancedToastOptions {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  undo?: {
    label?: string;
    onClick: () => void;
  };
  duration?: number;
}

const ToastContent = ({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  undo, 
  variant 
}: {
  icon: React.ComponentType<any>;
  title?: string;
  description?: string;
  action?: EnhancedToastOptions['action'];
  undo?: EnhancedToastOptions['undo'];
  variant: 'success' | 'error' | 'warning' | 'info';
}) => {
  const variants = {
    success: 'text-mint-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-brand-blue'
  };

  return (
    <div className="flex items-start gap-3 w-full">
      <Icon className={`w-5 h-5 mt-0.5 ${variants[variant]}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-semibold text-brand-navy tracking-tight">
            {title}
          </div>
        )}
        {description && (
          <div className="text-sm text-gray-600 leading-relaxed mt-1">
            {description}
          </div>
        )}
        {(action || undo) && (
          <div className="flex gap-2 mt-2">
            {undo && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  undo.onClick();
                  toast.dismiss();
                }}
                className="h-7 px-2 text-xs"
              >
                <Undo2 className="w-3 h-3 mr-1" />
                {undo.label || 'Undo'}
              </Button>
            )}
            {action && (
              <Button
                size="sm"
                onClick={() => {
                  action.onClick();
                  toast.dismiss();
                }}
                className="h-7 px-2 text-xs"
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const enhancedToast = {
  success: (message: string, options?: EnhancedToastOptions) => {
    toast.custom((t) => (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
        <ToastContent
          icon={CheckCircle}
          title={options?.title || message}
          description={options?.description}
          action={options?.action}
          undo={options?.undo}
          variant="success"
        />
      </div>
    ), { duration: options?.duration || 4000 });
  },

  error: (message: string, options?: EnhancedToastOptions) => {
    toast.custom((t) => (
      <div className="bg-white border border-red-200 rounded-lg shadow-lg p-4 max-w-md">
        <ToastContent
          icon={XCircle}
          title={options?.title || message}
          description={options?.description}
          action={options?.action}
          undo={options?.undo}
          variant="error"
        />
      </div>
    ), { duration: options?.duration || 6000 });
  },

  warning: (message: string, options?: EnhancedToastOptions) => {
    toast.custom((t) => (
      <div className="bg-white border border-amber-200 rounded-lg shadow-lg p-4 max-w-md">
        <ToastContent
          icon={AlertCircle}
          title={options?.title || message}
          description={options?.description}
          action={options?.action}
          undo={options?.undo}
          variant="warning"
        />
      </div>
    ), { duration: options?.duration || 5000 });
  },

  info: (message: string, options?: EnhancedToastOptions) => {
    toast.custom((t) => (
      <div className="bg-white border border-brand-blue/20 rounded-lg shadow-lg p-4 max-w-md">
        <ToastContent
          icon={Info}
          title={options?.title || message}
          description={options?.description}
          action={options?.action}
          undo={options?.undo}
          variant="info"
        />
      </div>
    ), { duration: options?.duration || 4000 });
  },

  publish: (scheduledDate: string, options?: { onUndo?: () => void }) => {
    enhancedToast.success('Scheduled for publishing', {
      description: `Your content will be published on ${scheduledDate}`,
      undo: options?.onUndo ? {
        label: 'Undo',
        onClick: options.onUndo
      } : undefined,
      duration: 6000
    });
  }
};