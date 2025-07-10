
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Wifi, FileCheck, Send, TrendingUp, X, Rocket } from 'lucide-react';
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
    <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Gradient Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
      <div className="absolute inset-0 bg-black/5"></div>
      
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-8 opacity-5">
          <CheckCircle2 className="w-32 h-32 text-green-600" />
        </div>
      </div>
      
      <CardContent className="relative z-10 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              Quick Start Guide
              <span className="text-lg font-semibold text-slate-500 bg-white/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/30">
                {completedCount}/{steps.length}
              </span>
            </h3>
            <p className="text-slate-600 font-medium mt-2">Get the most out of BloomSuite</p>
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
        <div className="mb-8">
          <div className="w-full bg-gradient-to-r from-slate-200 to-slate-300 rounded-full h-3 shadow-inner">
            <div 
              className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 h-3 rounded-full transition-all duration-500 ease-out shadow-lg"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Checklist Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6">
          {steps.map((step) => (
            <Button
              key={step.id}
              variant="ghost"
              className={`h-auto p-4 flex flex-col items-start text-left transition-all duration-300 hover:scale-105 hover:shadow-lg rounded-2xl border w-full overflow-hidden ${
                step.completed 
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200 shadow-md' 
                  : 'bg-white/70 backdrop-blur-sm border-white/30 hover:bg-white/90'
              }`}
              onClick={step.action}
            >
              <div className="flex items-center gap-3 mb-3 w-full">
                {step.completed ? (
                  <div className="p-1 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className="p-1 bg-slate-200 rounded-full flex-shrink-0">
                    <Circle className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <div className="p-2 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex-shrink-0">
                  {step.icon}
                </div>
              </div>
              <div className="w-full overflow-hidden">
                <div className="font-bold text-base bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent break-words">{step.title}</div>
                <div className="text-sm text-slate-600 mt-1 break-words">{step.description}</div>
              </div>
            </Button>
          ))}
        </div>

        {completedCount === steps.length && (
          <div className="mt-6 p-6 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl text-center shadow-lg">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <p className="text-lg font-bold bg-gradient-to-r from-emerald-800 to-green-800 bg-clip-text text-transparent">
              🎉 Congratulations! You've completed the quick start guide.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
