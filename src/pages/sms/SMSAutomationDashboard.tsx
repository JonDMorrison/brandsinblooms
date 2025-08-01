import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, SettingsIcon, PlayIcon, PauseIcon, EditIcon } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'

export default function SMSAutomationDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()

  // Fetch real SMS automation data
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['sms-automations', user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      
      const { data, error } = await supabase
        .from('sms_automations')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!tenant
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Active</Badge>
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>
      case 'draft':
        return <Badge variant="outline">Draft</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTriggerLabel = (trigger: any) => {
    if (typeof trigger === 'object' && trigger?.type) {
      switch (trigger.type) {
        case 'signup':
          return 'New Customer Signup'
        case 'purchase':
          return 'After Purchase'
        case 'abandoned_cart':
          return 'Abandoned Cart'
        case 'birthday':
          return 'Customer Birthday'
        case 'manual':
          return 'Manual Trigger'
        default:
          return trigger.type
      }
    }
    return 'Unknown Trigger'
  }

  const getFlowSteps = (flow: any) => {
    if (Array.isArray(flow)) {
      return flow;
    }
    if (typeof flow === 'object' && flow?.steps) {
      return flow.steps;
    }
    return [];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Automations</h1>
          <p className="text-muted-foreground">
            Set up automated SMS sequences to engage customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/sms')}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Back to SMS
          </Button>
          <Button onClick={() => navigate('/sms/automations/new')}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Automation
          </Button>
        </div>
      </div>

      {/* Automations List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8">Loading automations...</div>
        ) : automations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <SettingsIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No automations yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first SMS automation to engage customers automatically
              </p>
              <Button onClick={() => navigate('/sms/automations/new')}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Automation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {automations.map((automation) => {
              const flowSteps = getFlowSteps(automation.flow);
              return (
                <Card key={automation.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{automation.name}</CardTitle>
                          {getStatusBadge(automation.status)}
                        </div>
                        <CardDescription>{automation.description || 'SMS automation sequence'}</CardDescription>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Trigger: {getTriggerLabel(automation.trigger_config)}</span>
                          <span>•</span>
                          <span>{flowSteps.length} steps</span>
                          <span>•</span>
                          <span>{automation.trigger_type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {automation.status === 'active' ? (
                          <Button variant="outline" size="sm">
                            <PauseIcon className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm">
                            <PlayIcon className="h-3 w-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/sms/automations/${automation.id}`)}
                        >
                          <EditIcon className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Flow Steps Preview */}
                      <div className="md:col-span-2">
                        <h4 className="text-sm font-medium mb-3">Automation Flow</h4>
                        <div className="space-y-2">
                          {flowSteps.length > 0 ? flowSteps.map((step: any, index: number) => (
                            <div key={index} className="flex items-start gap-3 text-sm">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="text-muted-foreground text-xs mb-1">
                                  {step.delay_hours === 0 ? 'Immediately' : `After ${step.delay_hours || step.delay || 0}h`}
                                </div>
                                <div className="text-sm line-clamp-2">
                                  {step.message || step.content || 'SMS message content'}
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="text-sm text-muted-foreground">No steps configured</div>
                          )}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Performance</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span className="font-medium">{new Date(automation.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Updated:</span>
                            <span className="font-medium">{new Date(automation.updated_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <span className="font-medium">{automation.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}