
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConnectionAlertProps {
  show: boolean;
}

export const ConnectionAlert = ({ show }: ConnectionAlertProps) => {
  if (!show) return null;

  return (
    <div className="fixed top-20 right-6 z-50 bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-red-800 mb-1">No Social Connections</h4>
          <p className="text-sm text-red-700">
            Connect your social accounts to schedule posts automatically
          </p>
        </div>
      </div>
    </div>
  );
};
