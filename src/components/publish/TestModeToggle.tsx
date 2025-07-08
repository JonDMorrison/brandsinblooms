import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TestTube, Shield, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TestModeToggleProps {
  onTestModeChange: (enabled: boolean) => void;
}

export const TestModeToggle = ({ onTestModeChange }: TestModeToggleProps) => {
  const { user } = useAuth();
  const [testMode, setTestMode] = useState(false);

  // Load test mode preference
  useEffect(() => {
    const savedTestMode = localStorage.getItem(`publish_test_mode_${user?.id}`);
    if (savedTestMode === 'true') {
      setTestMode(true);
      onTestModeChange(true);
    }
  }, [user?.id, onTestModeChange]);

  const handleToggle = (enabled: boolean) => {
    setTestMode(enabled);
    onTestModeChange(enabled);
    
    // Save preference
    if (user?.id) {
      localStorage.setItem(`publish_test_mode_${user.id}`, enabled.toString());
    }
  };

  return (
    <Card className={`p-4 border-2 transition-colors ${
      testMode 
        ? 'border-orange-200 bg-orange-50' 
        : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          {testMode ? (
            <TestTube className="w-5 h-5 text-orange-600" />
          ) : (
            <Shield className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">Test Mode</h3>
              {testMode && (
                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                  Active
                </Badge>
              )}
            </div>
            
            <Switch
              checked={testMode}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-orange-600"
            />
          </div>
          
          <p className="text-xs text-gray-600 mb-3">
            {testMode 
              ? 'Publishing in test mode - posts will be simulated without going live'
              : 'Test mode disabled - posts will be published live to social media'
            }
          </p>
          
          {testMode && (
            <div className="bg-orange-100 border border-orange-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-800">
                  <p className="font-medium mb-1">Test Mode Features:</p>
                  <ul className="space-y-0.5 text-xs">
                    <li>• Posts are simulated, not actually published</li>
                    <li>• Full validation and error checking</li>
                    <li>• API calls are mocked for safety</li>
                    <li>• Perfect for testing workflows</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {!testMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  <span className="font-medium">Live Mode:</span> All posts will be published directly to your connected social media accounts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};