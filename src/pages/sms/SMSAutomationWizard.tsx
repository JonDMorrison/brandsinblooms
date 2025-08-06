import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, PlusIcon, TrashIcon, SettingsIcon } from 'lucide-react'
import { SMSComposer } from '@/components/sms/SMSComposer'

interface AutomationStep {
  id: string
  step: number
  delay_hours: number
  message: string
  image_url?: string
}

const TRIGGER_TYPES = [
  { value: 'signup', label: 'New Customer Signup', description: 'When a customer first joins your list' },
  { value: 'purchase', label: 'After Purchase', description: 'Following a completed purchase' },
  { value: 'abandoned_cart', label: 'Abandoned Cart', description: 'When items are left in cart' },
  { value: 'birthday', label: 'Customer Birthday', description: 'On the customer\'s birthday' },
  { value: 'manual', label: 'Manual Trigger', description: 'Triggered manually by staff' }
]

export default function SMSAutomationWizard() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [automationData, setAutomationData] = useState({
    name: '',
    description: '',
    trigger_type: '',
    trigger_config: {},
    status: 'draft' as 'draft' | 'active' | 'paused'
  })

  const [steps, setSteps] = useState<AutomationStep[]>([
    { id: '1', step: 1, delay_hours: 0, message: '' }
  ])

  const addStep = () => {
    const newStep: AutomationStep = {
      id: Date.now().toString(),
      step: steps.length + 1,
      delay_hours: 24,
      message: ''
    }
    setSteps([...steps, newStep])
  }

  const removeStep = (stepId: string) => {
    if (steps.length > 1) {
      const newSteps = steps.filter(s => s.id !== stepId)
      // Renumber steps
      newSteps.forEach((step, index) => {
        step.step = index + 1
      })
      setSteps(newSteps)
    }
  }

  const updateStep = (stepId: string, field: keyof AutomationStep, value: any) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, [field]: value } : step
    ))
  }

  const handleSave = () => {
    // TODO: Save automation
    console.log('Saving automation:', { ...automationData, flow: steps })
    navigate('/sms/automations')
  }

  const handleActivate = () => {
    setAutomationData(prev => ({ ...prev, status: 'active' }))
    handleSave()
  }

  const getDelayLabel = (hours: number) => {
    if (hours === 0) return 'Immediately'
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`
    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''}`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sms/automations')}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Automations
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditing ? 'Edit SMS Automation' : 'Create SMS Automation'}
            </h1>
            <p className="text-muted-foreground">
              Set up automated SMS sequences to engage customers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave}>
            Save Draft
          </Button>
          <Button onClick={handleActivate}>
            <SettingsIcon className="h-4 w-4 mr-2" />
            Save & Activate
          </Button>
        </div>
      </div>

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Settings</CardTitle>
          <CardDescription>Configure the basic settings for your automation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Automation Name</Label>
              <Input
                id="name"
                value={automationData.name}
                onChange={(e) => setAutomationData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Welcome Series"
              />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger Event</Label>
              <Select
                value={automationData.trigger_type}
                onValueChange={(value) => setAutomationData(prev => ({ ...prev, trigger_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger event" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      <div>
                        <div className="font-medium">{trigger.label}</div>
                        <div className="text-xs text-muted-foreground">{trigger.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={automationData.description}
              onChange={(e) => setAutomationData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this automation does..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Automation Flow */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automation Flow</CardTitle>
              <CardDescription>Design the sequence of messages customers will receive</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addStep}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {/* Step connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-4 top-16 w-0.5 h-8 bg-border" />
                )}
                
                <div className="flex items-start gap-4">
                  {/* Step number */}
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {step.step}
                  </div>
                  
                  {/* Step content */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">
                          Step {step.step}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`delay-${step.id}`} className="text-sm">
                            Send after:
                          </Label>
                          <Select
                            value={step.delay_hours.toString()}
                            onValueChange={(value) => updateStep(step.id, 'delay_hours', parseInt(value))}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Immediately</SelectItem>
                              <SelectItem value="1">1 hour</SelectItem>
                              <SelectItem value="6">6 hours</SelectItem>
                              <SelectItem value="24">1 day</SelectItem>
                              <SelectItem value="48">2 days</SelectItem>
                              <SelectItem value="72">3 days</SelectItem>
                              <SelectItem value="168">1 week</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(step.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor={`message-${step.id}`}>Message</Label>
                      <div className="mt-2">
                        <SMSComposer
                          value={step.message}
                          onChange={(value) => updateStep(step.id, 'message', value)}
                          imageUrl={step.image_url}
                          onImageChange={(imageUrl) => updateStep(step.id, 'image_url', imageUrl)}
                          placeholder={`Enter message for step ${step.step}...`}
                          showImageUpload={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Summary</CardTitle>
          <CardDescription>Review your automation before saving</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">Name</div>
                <div className="text-sm text-muted-foreground">
                  {automationData.name || 'Untitled Automation'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Trigger</div>
                <div className="text-sm text-muted-foreground">
                  {TRIGGER_TYPES.find(t => t.value === automationData.trigger_type)?.label || 'Not selected'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Flow ({steps.length} steps)</div>
              <div className="space-y-1">
                {steps.map((step) => (
                  <div key={step.id} className="text-xs text-muted-foreground">
                    Step {step.step}: {getDelayLabel(step.delay_hours)} - 
                    {step.message ? ` "${step.message.substring(0, 50)}${step.message.length > 50 ? '...' : ''}"` : ' No message'}
                    {step.image_url && <span className="text-blue-600"> + Image (MMS)</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}