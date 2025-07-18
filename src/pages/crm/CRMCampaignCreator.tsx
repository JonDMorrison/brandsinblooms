
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import SmartCampaignSelector from '@/components/crm/SmartCampaignSelector';
import MultiSegmentSelector from '@/components/crm/MultiSegmentSelector';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  Send,
  Calendar,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

// Import the email builder component
import CRMCampaignBuilder from './CRMCampaignBuilder';

interface CampaignData {
  name: string;
  subject_line: string;
  content: string;
  segment_ids: string[];
  template_id?: string;
  scheduled_at?: string;
}

const CRMCampaignCreator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject_line: '',
    content: '',
    segment_ids: []
  });
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (duplicateId) {
      loadCampaignForDuplication();
    }
  }, [duplicateId]);

  const loadCampaignForDuplication = async () => {
    if (!duplicateId) return;

    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', duplicateId)
        .single();

      if (error) throw error;

      setCampaignData({
        name: `Copy of ${data.name}`,
        subject_line: data.subject_line || '',
        content: data.content || '',
        segment_ids: data.segment_id ? [data.segment_id] : []
      });
    } catch (error) {
      console.error('Error loading campaign for duplication:', error);
      toast.error('Failed to load campaign');
    }
  };

  const createCampaign = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) {
        throw new Error('No tenant found');
      }

      // Create the campaign
      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert({
          name: campaignData.name,
          subject_line: campaignData.subject_line,
          content: campaignData.content,
          tenant_id: userData.tenant_id,
          user_id: user.id,
          segment_id: campaignData.segment_ids[0] || null,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedCampaignId(data.id);
      setCurrentStep(3); // Move to email builder step
      toast.success('Campaign created successfully!');

    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setCampaignData(prev => ({
      ...prev,
      name: prev.name || template.name,
      subject_line: prev.subject_line || template.preview.subject
    }));
  };

  const steps = [
    {
      id: 1,
      title: 'Campaign Source',
      description: 'Choose a template or start from scratch'
    },
    {
      id: 2,
      title: 'Campaign Details',
      description: 'Set up your campaign name, audience, and basic settings'
    },
    {
      id: 3,
      title: 'Email Design',
      description: 'Design your email using our drag-and-drop builder'
    }
  ];

  const canProceedToStep2 = selectedTemplate || campaignData.name;
  const canProceedToStep3 = campaignData.name && campaignData.subject_line && campaignData.segment_ids.length > 0;

  return (
    <SubscriptionGate 
      requiredPlan="bloom" 
      feature="Email Campaigns"
    >
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/crm/campaigns')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Campaigns
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Create Email Campaign</h1>
                <p className="text-muted-foreground">
                  {steps.find(s => s.id === currentStep)?.description}
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4 mt-6">
              {steps.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                const isAccessible = step.id === 1 || 
                  (step.id === 2 && canProceedToStep2) ||
                  (step.id === 3 && createdCampaignId);

                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : isCompleted 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                            : isAccessible
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                              : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                      }`}
                      onClick={() => isAccessible && setCurrentStep(step.id)}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                        isCompleted ? 'bg-green-600 text-white' : ''
                      }`}>
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : step.id}
                      </div>
                      <span className="font-medium">{step.title}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto p-6">
          {currentStep === 1 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <SmartCampaignSelector
                onTemplateSelect={handleTemplateSelect}
                selectedTemplate={selectedTemplate}
              />
              
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => navigate('/crm/campaigns')}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedToStep2}
                  className="gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campaign Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="campaignName">Campaign Name *</Label>
                      <Input
                        id="campaignName"
                        value={campaignData.name}
                        onChange={(e) => setCampaignData(prev => ({
                          ...prev,
                          name: e.target.value
                        }))}
                        placeholder="Enter campaign name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="subjectLine">Subject Line *</Label>
                      <Input
                        id="subjectLine"
                        value={campaignData.subject_line}
                        onChange={(e) => setCampaignData(prev => ({
                          ...prev,
                          subject_line: e.target.value
                        }))}
                        placeholder="Enter email subject line"
                      />
                    </div>

                    {selectedTemplate && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="font-medium">Using Template</span>
                        </div>
                        <Badge variant="outline">{selectedTemplate.name}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Customer Segments */}
                <MultiSegmentSelector
                  selectedSegments={campaignData.segment_ids}
                  onSegmentsChange={(segments) => setCampaignData(prev => ({
                    ...prev,
                    segment_ids: segments
                  }))}
                  maxSelections={1}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={createCampaign}
                  disabled={!canProceedToStep3 || loading}
                  className="gap-2"
                >
                  {loading ? 'Creating...' : 'Create & Design Email'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {currentStep === 3 && createdCampaignId && (
            <div className="max-w-full">
              <CRMCampaignBuilder />
            </div>
          )}
        </div>
      </div>
    </SubscriptionGate>
  );
};

export default CRMCampaignCreator;
