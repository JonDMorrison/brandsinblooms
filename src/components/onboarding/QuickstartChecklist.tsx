
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Wifi, FileCheck, Send, TrendingUp, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
  action: () => void;
}

interface QuickstartChecklistProps {
  onDismiss: () => void;
  onNavigateToSection: (section: string) => void;
}

export const QuickstartChecklist: React.FC<QuickstartChecklistProps> = ({ 
  onDismiss, 
  onNavigateToSection 
}) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [checklistState, setChecklistState] = useState({
    connectedAccounts: false,
    approvedContent: false,
    postedContent: false,
    viewedAnalytics: false
  });

  // Check completion status for each step
  useEffect(() => {
    const checkCompletionStatus = async () => {
      if (!user || !tenant) return;

      try {
        // Check connected accounts
        const { data: connections } = await supabase
          .from('social_connections')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        // Check approved content
        const { data: approvedTasks } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('status', 'approved')
          .limit(1);

        // Check posted content
        const { data: postedTasks } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('status', 'posted')
          .limit(1);

        // Check if analytics was viewed (stored in localStorage)
        const viewedAnalytics = localStorage.getItem(`analytics_viewed_${user.id}`) === 'true';

        setChecklistState({
          connectedAccounts: !!(connections && connections.length > 0),
          approvedContent: !!(approvedTasks && approvedTasks.length > 0),
          postedContent: !!(postedTasks && postedTasks.length > 0),
          viewedAnalytics
        });
      } catch (error) {
        console.error('Error checking checklist status:', error);
      }
    };

    checkCompletionStatus();
  }, [user, tenant]);

  const steps: ChecklistStep[] = [
    {
      id: 'connected',
      title: 'Connect your accounts',
      description: 'Link Facebook & Instagram',
      completed: checklistState.connectedAccounts,
      icon: <Wifi className="w-4 h-4" />,
      action: () => onNavigateToSection('social')
    },
    {
      id: 'approved',
      title: 'Approve your first content',
      description: 'Review and approve a post',
      completed: checklistState.approvedContent,
      icon: <FileCheck className="w-4 h-4" />,
      action: () => onNavigateToSection('weekly-content')
    },
    {
      id: 'posted',
      title: 'Post it live',
      description: 'Publish to Facebook/Instagram',
      completed: checklistState.postedContent,
      icon: <Send className="w-4 h-4" />,
      action: () => onNavigateToSection('ready-to-post')
    },
    {
      id: 'analytics',
      title: 'Watch engagement grow',
      description: 'Check your performance',
      completed: checklistState.viewedAnalytics,
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => {
        localStorage.setItem(`analytics_viewed_${user?.id}`, 'true');
        setChecklistState(prev => ({ ...prev, viewedAnalytics: true }));
        // Navigate to analytics when available
      }
    }
  ];

  const completedCount = steps.filter(step => step.completed).length;
  const progressPercentage = (completedCount / steps.length) * 100;

  return (
    <Card className="border-2 border-garden-green/20 bg-gradient-to-r from-garden-sage/30 to-garden-background shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🚀 Quick Start Guide
              <span className="text-sm font-normal text-gray-600">
                ({completedCount}/{steps.length})
              </span>
            </h3>
            <p className="text-sm text-gray-600">Get the most out of BloomSuite</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-garden-green h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Checklist Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((step) => (
            <Button
              key={step.id}
              variant="ghost"
              className={`h-auto p-3 flex flex-col items-start text-left hover:bg-white/80 transition-all duration-200 ${
                step.completed ? 'bg-green-50 border border-green-200' : 'bg-white/50'
              }`}
              onClick={step.action}
            >
              <div className="flex items-center gap-2 mb-2 w-full">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
                {step.icon}
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900">{step.title}</div>
                <div className="text-xs text-gray-600">{step.description}</div>
              </div>
            </Button>
          ))}
        </div>

        {completedCount === steps.length && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm font-medium text-green-800">
              🎉 Congratulations! You've completed the quick start guide.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
