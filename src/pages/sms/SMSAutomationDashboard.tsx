import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, SettingsIcon, PlayIcon, PauseIcon, EditIcon } from 'lucide-react'

// Placeholder data - replace with actual data fetching
const SAMPLE_AUTOMATIONS = [
  {
    id: '1',
    name: 'Welcome Series',
    description: 'Greet new customers with a 3-part welcome sequence',
    trigger_type: 'signup',
    status: 'active',
    flow: [
      { step: 1, delay_hours: 0, message: 'Welcome to Garden Center! Thanks for joining us 🌱' },
      { step: 2, delay_hours: 24, message: 'Here are some beginner gardening tips to get you started...' },
      { step: 3, delay_hours: 72, message: 'Ready for your first purchase? Use code WELCOME10 for 10% off!' }
    ],
    metrics: {
      enrolled: 45,
      completed: 32,
      conversion_rate: 12.5
    }
  },
  {
    id: '2',
    name: 'Abandoned Cart Recovery',
    description: 'Remind customers about items left in their cart',
    trigger_type: 'abandoned_cart',
    status: 'paused',
    flow: [
      { step: 1, delay_hours: 1, message: 'Forgot something? Your cart is waiting! Complete your order now.' },
      { step: 2, delay_hours: 24, message: 'Still thinking it over? Get 10% off your cart with code SAVE10' }
    ],
    metrics: {
      enrolled: 28,
      completed: 18,
      conversion_rate: 8.2
    }
  }
]

export default function SMSAutomationDashboard() {
  const navigate = useNavigate()

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

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
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
        return trigger
    }
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
        {SAMPLE_AUTOMATIONS.length === 0 ? (
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
            {SAMPLE_AUTOMATIONS.map((automation) => (
              <Card key={automation.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{automation.name}</CardTitle>
                        {getStatusBadge(automation.status)}
                      </div>
                      <CardDescription>{automation.description}</CardDescription>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Trigger: {getTriggerLabel(automation.trigger_type)}</span>
                        <span>•</span>
                        <span>{automation.flow.length} steps</span>
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
                        {automation.flow.map((step) => (
                          <div key={step.step} className="flex items-start gap-3 text-sm">
                            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium mt-0.5">
                              {step.step}
                            </div>
                            <div className="flex-1">
                              <div className="text-muted-foreground text-xs mb-1">
                                {step.delay_hours === 0 ? 'Immediately' : `After ${step.delay_hours}h`}
                              </div>
                              <div className="text-sm line-clamp-2">
                                {step.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Performance</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Enrolled:</span>
                          <span className="font-medium">{automation.metrics.enrolled}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed:</span>
                          <span className="font-medium">{automation.metrics.completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conversion:</span>
                          <span className="font-medium">{automation.metrics.conversion_rate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}