import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, ArrowRightIcon, UsersIcon, MessageSquareIcon, SendIcon } from 'lucide-react'
import { SMSComposer } from '@/components/sms/SMSComposer'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'
import { useAllSegments } from '@/hooks/useAllSegments'
import { toast } from 'sonner'

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
  const { user } = useAuth()
  const { tenant } = useTenant()
  const { segments } = useAllSegments()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    scheduled_at: null as string | null
  })
  const [selectedSegments, setSelectedSegments] = useState<Array<{id: string, name: string}>>([])

  // Fetch real customer data
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['sms-customers', user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      
      const { data, error } = await supabase
        .from('crm_customers')
        .select('id, email, first_name, last_name, phone, sms_opt_in')
        .eq('tenant_id', tenant.id)
        .eq('sms_opt_in', true); // Only SMS opted-in customers
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!tenant
  });

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

  const handleCreateCampaign = async () => {
    try {
      if (!user || !tenant) {
        toast.error('Authentication required');
        return;
      }

      const campaignData = {
        ...formData,
        tenant_id: tenant.id,
        user_id: user.id,
        status: 'draft' as const,
        metrics: {
          sent: 0,
          delivered: 0,
          clicked: 0,
          opt_outs: 0,
          revenue: 0
        }
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('crm_sms_campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (campaignError) throw campaignError;

      if (campaign) {
        // Create SMS messages for selected customers
        const targetCustomers = selectedSegments.some(segment => segment.id === 'all-customers') 
          ? customers 
          : customers.filter(customer => 
              selectedSegments.some(segment => {
                // For now, if any segment is selected, include all opted-in customers
                // TODO: Implement proper segment filtering
                return true;
              })
            );

        if (targetCustomers.length === 0) {
          toast.error('No customers found for selected segments');
          return;
        }

        const messagePromises = targetCustomers.map(customer => 
          supabase.from('sms_messages').insert({
            campaign_id: campaign.id,
            customer_id: customer.id,
            phone: customer.phone,
            content: formData.message,
            status: formData.scheduled_at ? 'queued' : 'sent',
            scheduled_at: formData.scheduled_at || new Date().toISOString()
          })
        );

        await Promise.all(messagePromises);

        toast.success(`SMS campaign created! ${targetCustomers.length} messages queued.`);
        navigate('/sms');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create SMS campaign');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Spring Sale Alert"
              />
            </div>
            
            <div>
              <Label>Target Audience</Label>
              <div className="mt-2 space-y-2">
                <Card className={`cursor-pointer transition-colors ${
                  selectedSegments.some(s => s.id === 'all-customers') ? 'ring-2 ring-primary' : ''
                }`} onClick={() => {
                  if (selectedSegments.some(s => s.id === 'all-customers')) {
                    setSelectedSegments([]);
                  } else {
                    setSelectedSegments([{ id: 'all-customers', name: 'All SMS Subscribers' }]);
                  }
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UsersIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">All SMS Subscribers</p>
                          <p className="text-sm text-muted-foreground">
                            {customers.filter(c => c.sms_opt_in).length} customers
                          </p>
                        </div>
                      </div>
                      <Badge variant={selectedSegments.some(s => s.id === 'all-customers') ? 'default' : 'outline'}>
                        {selectedSegments.some(s => s.id === 'all-customers') ? 'Selected' : 'Select'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {segments.slice(0, 3).map(segment => (
                  <Card key={segment.id} className={`cursor-pointer transition-colors ${
                    selectedSegments.some(s => s.id === segment.id) ? 'ring-2 ring-primary' : ''
                  }`} onClick={() => {
                    if (selectedSegments.some(s => s.id === segment.id)) {
                      setSelectedSegments(prev => prev.filter(s => s.id !== segment.id));
                    } else {
                      setSelectedSegments(prev => [...prev, { id: segment.id, name: segment.name }]);
                    }
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <UsersIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{segment.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {segment.customer_count} customers
                            </p>
                          </div>
                        </div>
                        <Badge variant={selectedSegments.some(s => s.id === segment.id) ? 'default' : 'outline'}>
                          {selectedSegments.some(s => s.id === segment.id) ? 'Selected' : 'Select'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedSegments.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedSegments.length} segments • {customers.filter(c => c.sms_opt_in).length} opted-in customers
                  </div>
                </div>
              )}
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
                  value={formData.message}
                  onChange={(value) => setFormData(prev => ({ ...prev, message: value }))}
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
                  <span className="font-medium">{formData.name || 'Untitled Campaign'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipients:</span>
                  <span className="font-medium">{customers.filter(c => c.sms_opt_in).length} customers</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message:</span>
                  <span className="font-medium">
                    {formData.message ? `${formData.message.length} characters` : 'No message'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4">
              <Button onClick={handleCreateCampaign} className="flex-1" disabled={!formData.name || !formData.message}>
                <SendIcon className="h-4 w-4 mr-2" />
                Send Now
              </Button>
              <Button variant="outline" className="flex-1" disabled>
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
          <Button 
            onClick={handleNext}
            disabled={
              (currentStep === 1 && selectedSegments.length === 0) ||
              (currentStep === 2 && !formData.message)
            }
          >
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