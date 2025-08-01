import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, ArrowRightIcon, UsersIcon, MessageSquareIcon, SendIcon } from 'lucide-react'
import { SMSComposer } from '@/components/sms/SMSComposer'

interface WizardStep {
  id: number
  title: string
  description: string
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: 'Audience', description: 'Choose who will receive your SMS' },
  { id: 2, title: 'Message', description: 'Compose your SMS message' },
  { id: 3, title: 'Send', description: 'Schedule and send your campaign' }
]

export default function SMSCampaignWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [campaignData, setCampaignData] = useState({
    name: '',
    message: '',
    segmentId: '',
    scheduledAt: null as Date | null
  })

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = () => {
    // TODO: Create SMS campaign
    console.log('Creating SMS campaign:', campaignData)
    navigate('/sms')
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignData.name}
                onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Spring Sale Alert"
              />
            </div>
            
            <div>
              <Label>Target Audience</Label>
              <Card className="mt-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UsersIcon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">All SMS Subscribers</p>
                        <p className="text-sm text-muted-foreground">1,250 customers</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>SMS Message</Label>
              <div className="mt-2">
                <SMSComposer
                  value={campaignData.message}
                  onChange={(value) => setCampaignData(prev => ({ ...prev, message: value }))}
                  placeholder="Compose your SMS message..."
                />
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
                <CardDescription>Review your SMS campaign before sending</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign Name:</span>
                  <span className="font-medium">{campaignData.name || 'Untitled Campaign'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients:</span>
                  <span className="font-medium">1,250 customers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message:</span>
                  <span className="font-medium">
                    {campaignData.message ? `${campaignData.message.length} characters` : 'No message'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4">
              <Button onClick={handleFinish} className="flex-1">
                <SendIcon className="h-4 w-4 mr-2" />
                Send Now
              </Button>
              <Button variant="outline" className="flex-1">
                Schedule for Later
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/sms')}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to SMS
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create SMS Campaign</h1>
          <p className="text-muted-foreground">
            Send targeted SMS messages to your customers
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step) => (
          <div key={step.id} className="flex items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep >= step.id 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
              }
            `}>
              {step.id}
            </div>
            <div className="ml-3 hidden sm:block">
              <p className={`text-sm font-medium ${
                currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
            {step.id < WIZARD_STEPS.length && (
              <div className={`
                w-12 h-0.5 mx-4 
                ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareIcon className="h-5 w-5" />
            {WIZARD_STEPS[currentStep - 1]?.title}
          </CardTitle>
          <CardDescription>
            {WIZARD_STEPS[currentStep - 1]?.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1}
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < WIZARD_STEPS.length ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Badge variant="secondary" className="px-4 py-2">
            Ready to send
          </Badge>
        )}
      </div>
    </div>
  )
}