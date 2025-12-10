import React, { useState, useEffect } from 'react';
import { X, Bug, ChevronDown, ChevronUp, Trash2, AlertTriangle, Wifi, Code, Zap } from 'lucide-react';
import { 
  subscribeToErrors, 
  getStoredErrors, 
  clearStoredErrors,
  type ErrorLogEntry 
} from '@/utils/devErrorLogger';

const isDev = () => {
  return import.meta.env.DEV || 
         window.location.hostname.includes('lovableproject.com') ||
         window.location.hostname === 'localhost';
};

const ErrorTypeIcon = ({ type }: { type: ErrorLogEntry['type'] }) => {
  switch (type) {
    case 'network':
      return <Wifi className="w-3 h-3" />;
    case 'react':
      return <Code className="w-3 h-3" />;
    case 'supabase':
      return <Zap className="w-3 h-3" />;
    default:
      return <AlertTriangle className="w-3 h-3" />;
  }
};

const ErrorEntry = ({ error, isExpanded, onToggle }: { 
  error: ErrorLogEntry; 
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const typeColors: Record<ErrorLogEntry['type'], string> = {
    runtime: 'bg-red-500',
    network: 'bg-orange-500',
    promise: 'bg-purple-500',
    react: 'bg-blue-500',
    supabase: 'bg-green-500',
  };

  return (
    <div className="border-b border-gray-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full p-2 text-left hover:bg-gray-800 transition-colors flex items-start gap-2"
      >
        <span className={`${typeColors[error.type]} text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 mt-0.5`}>
          <ErrorTypeIcon type={error.type} />
          {error.type}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-200 truncate font-mono">{error.message}</p>
          <p className="text-[10px] text-gray-500">
            {new Date(error.timestamp).toLocaleTimeString()}
            {error.functionName && ` • ${error.functionName}`}
            {error.statusCode && ` • ${error.statusCode}`}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-2 bg-gray-900 text-xs space-y-2">
          {error.statusCode && (
            <div>
              <span className="text-gray-400">Status: </span>
              <span className="text-red-400 font-mono">{error.statusCode}</span>
            </div>
          )}
          
          {error.errorBody && (
            <div>
              <span className="text-gray-400">Error Body:</span>
              <pre className="mt-1 p-2 bg-gray-950 rounded text-[10px] overflow-x-auto text-red-300 font-mono">
                {JSON.stringify(error.errorBody, null, 2)}
              </pre>
            </div>
          )}
          
          {error.requestPayload && (
            <div>
              <span className="text-gray-400">Request Payload:</span>
              <pre className="mt-1 p-2 bg-gray-950 rounded text-[10px] overflow-x-auto text-blue-300 font-mono">
                {JSON.stringify(error.requestPayload, null, 2)}
              </pre>
            </div>
          )}
          
          {error.context && Object.keys(error.context).length > 0 && (
            <div>
              <span className="text-gray-400">Context:</span>
              <pre className="mt-1 p-2 bg-gray-950 rounded text-[10px] overflow-x-auto text-green-300 font-mono">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
          
          {error.stack && (
            <div>
              <span className="text-gray-400">Stack Trace:</span>
              <pre className="mt-1 p-2 bg-gray-950 rounded text-[10px] overflow-x-auto text-gray-300 font-mono whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isDev()) return;
    
    // Load initial errors
    setErrors(getStoredErrors());
    
    // Subscribe to new errors
    const unsubscribe = subscribeToErrors((newErrors) => {
      setErrors(newErrors);
      // Auto-open panel when new error arrives
      if (newErrors.length > 0 && !isOpen) {
        setIsOpen(true);
        setIsMinimized(false);
      }
    });
    
    return unsubscribe;
  }, []);

  if (!isDev()) return null;

  // Floating bug button when panel is closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 right-4 z-[9999] p-3 rounded-full shadow-lg transition-all ${
          errors.length > 0 
            ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
            : 'bg-gray-800 hover:bg-gray-700'
        }`}
        title={`Debug Panel${errors.length > 0 ? ` (${errors.length} errors)` : ''}`}
      >
        <Bug className="w-5 h-5 text-white" />
        {errors.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {errors.length > 9 ? '9+' : errors.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-0 right-0 z-[9999] bg-gray-900 border border-gray-700 rounded-tl-lg shadow-2xl transition-all ${
        isMinimized ? 'w-64' : 'w-96'
      }`}
      style={{ maxHeight: isMinimized ? '40px' : '400px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 rounded-tl-lg border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium text-white">Debug Panel</span>
          {errors.length > 0 && (
            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {errors.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clearStoredErrors()}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Clear errors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
          {errors.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No errors captured yet
            </div>
          ) : (
            errors.map((error) => (
              <ErrorEntry
                key={error.id}
                error={error}
                isExpanded={expandedId === error.id}
                onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
