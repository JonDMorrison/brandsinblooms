import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bug, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Database,
  Wifi,
  Send,
  Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PublishDebuggerProps {
  isVisible: boolean;
  onClose: () => void;
}

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'connection' | 'publishing' | 'database' | 'auth' | 'api';
  message: string;
  data?: any;
}

export const PublishDebugger = ({ isVisible, onClose }: PublishDebuggerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Add log entry
  const addLog = (level: DebugLog['level'], category: DebugLog['category'], message: string, data?: any) => {
    const log: DebugLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };
    
    setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    console.log(`[PublishDebugger] ${level.toUpperCase()}: ${message}`, data);
  };

  // Test social connections
  const testConnections = async () => {
    addLog('info', 'connection', 'Testing social media connections...');
    
    try {
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('is_active', true);

      if (error) {
        addLog('error', 'connection', 'Failed to fetch social connections', error);
        return;
      }

      addLog('success', 'connection', `Found ${data.length} active connections`, data);
      
      // Test each connection
      for (const connection of data) {
        const isExpired = connection.expires_at && new Date(connection.expires_at) < new Date();
        if (isExpired) {
          addLog('warning', 'connection', `Connection ${connection.platform} token expired`, connection);
        } else {
          addLog('success', 'connection', `Connection ${connection.platform} is valid`);
        }
      }
    } catch (error) {
      addLog('error', 'connection', 'Connection test failed', error);
    }
  };

  // Test content availability
  const testContent = async () => {
    addLog('info', 'database', 'Testing approved content availability...');
    
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('id, status, post_type, ai_output')
        .eq('status', 'approved')
        .in('post_type', ['facebook', 'instagram'])
        .limit(5);

      if (error) {
        addLog('error', 'database', 'Failed to fetch content', error);
        return;
      }

      addLog('success', 'database', `Found ${data.length} approved posts`, data);
      
      data.forEach(content => {
        if (!content.ai_output || content.ai_output.trim().length === 0) {
          addLog('warning', 'database', `Content ${content.id} has no caption`);
        }
      });
    } catch (error) {
      addLog('error', 'database', 'Content test failed', error);
    }
  };

  // Test publishing API
  const testPublishAPI = async () => {
    addLog('info', 'api', 'Testing publish API endpoint...');
    
    try {
      // Test with a mock request to see if the function responds
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          test: true,
          dryRun: true
        }
      });

      if (error) {
        addLog('error', 'api', 'Publish API test failed', error);
      } else {
        addLog('success', 'api', 'Publish API is responsive', data);
      }
    } catch (error) {
      addLog('error', 'api', 'Publish API connection failed', error);
    }
  };

  // Test authentication
  const testAuth = async () => {
    addLog('info', 'auth', 'Testing authentication state...');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        addLog('error', 'auth', 'Auth session error', error);
        return;
      }

      if (!session) {
        addLog('error', 'auth', 'No active session');
        return;
      }

      addLog('success', 'auth', 'User session is valid', {
        userId: session.user.id,
        expiresAt: session.expires_at
      });
    } catch (error) {
      addLog('error', 'auth', 'Auth test failed', error);
    }
  };

  // Run comprehensive test
  const runDiagnostics = async () => {
    setIsRunning(true);
    setLogs([]); // Clear previous logs
    
    addLog('info', 'connection', 'Starting publish portal diagnostics...');
    
    try {
      await testAuth();
      await testConnections();
      await testContent();
      await testPublishAPI();
      
      addLog('success', 'connection', 'Diagnostics complete!');
      toast({
        title: "Success!",
        description: "Diagnostics completed successfully",
      });
    } catch (error) {
      addLog('error', 'connection', 'Diagnostics failed', error);
      toast({
        title: "Error",
        description: "Diagnostics failed",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'connection', 'Debug logs cleared');
  };

  // Get icon for log level
  const getLogIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'success': return <Check className="w-4 h-4 text-green-600" />;
      case 'error': return <X className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <Clock className="w-4 h-4 text-blue-600" />;
    }
  };

  // Get category icon
  const getCategoryIcon = (category: DebugLog['category']) => {
    switch (category) {
      case 'connection': return <Wifi className="w-3 h-3" />;
      case 'publishing': return <Send className="w-3 h-3" />;
      case 'database': return <Database className="w-3 h-3" />;
      case 'auth': return <Eye className="w-3 h-3" />;
      case 'api': return <RefreshCw className="w-3 h-3" />;
      default: return <Bug className="w-3 h-3" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Publish Portal Debugger</h2>
              <p className="text-sm text-gray-600">Diagnose publishing issues and test connections</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-4">
          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="bg-primary hover:bg-primary/90"
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bug className="w-4 h-4 mr-2" />
              )}
              {isRunning ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
            </Button>
            
            <Button variant="outline" onClick={clearLogs}>
              Clear Logs
            </Button>

            <div className="flex gap-2 ml-auto">
              <Badge variant="outline" className="text-xs">
                {logs.length} logs
              </Badge>
              <Badge variant="outline" className="text-xs">
                {logs.filter(l => l.level === 'error').length} errors
              </Badge>
            </div>
          </div>

          {/* Log Display */}
          <Card className="flex-1">
            <ScrollArea className="h-full p-4">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bug className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No debug logs yet. Run diagnostics to start testing.</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div 
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getLogIcon(log.level)}
                        {getCategoryIcon(log.category)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p className="text-sm">{log.message}</p>
                        
                        {log.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View data
                            </summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </Card>
    </div>
  );
};