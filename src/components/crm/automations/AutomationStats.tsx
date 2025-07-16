import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Pause, Mail, MessageSquare, TrendingUp } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  workflow_steps: any;
  is_active: boolean;
  created_at: string;
  tenant_id: string;
  user_id: string;
  trigger_conditions: any;
}

interface AutomationStatsProps {
  automations: Automation[];
}

export function AutomationStats({ automations }: AutomationStatsProps) {
  const totalAutomations = automations.length;
  const activeAutomations = automations.filter(a => a.is_active).length;
  
  const totalEmailSteps = automations.reduce((acc, automation) => {
    if (automation.workflow_steps && Array.isArray(automation.workflow_steps)) {
      return acc + automation.workflow_steps.filter(step => step.type === 'email').length;
    }
    return acc;
  }, 0);
  
  const totalSmsSteps = automations.reduce((acc, automation) => {
    if (automation.workflow_steps && Array.isArray(automation.workflow_steps)) {
      return acc + automation.workflow_steps.filter(step => step.type === 'sms').length;
    }
    return acc;
  }, 0);

  const stats = [
    {
      title: 'Total Automations',
      value: totalAutomations,
      icon: TrendingUp,
      description: 'All automations created'
    },
    {
      title: 'Active Automations',
      value: activeAutomations,
      icon: Play,
      description: 'Currently running'
    },
    {
      title: 'Email Steps',
      value: totalEmailSteps,
      icon: Mail,
      description: 'Across all automations'
    },
    {
      title: 'SMS Steps',
      value: totalSmsSteps,
      icon: MessageSquare,
      description: 'Across all automations'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}