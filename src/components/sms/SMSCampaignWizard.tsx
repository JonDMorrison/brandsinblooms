import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Users, MessageSquare, Send, CheckCircle, User, Target, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useCRMPersonas } from '@/hooks/useCRMPersonas';
import { toast } from 'sonner';
import { SMSComposer } from './SMSComposer';
import { RecipientsPreview } from './RecipientsPreview';

interface CRMSegment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
}

interface CRMCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  sms_opt_in: boolean;
  persona_id?: string;
  persona?: string;
}

interface CRMPersona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

const STEPS = [
  { id: 1, title: 'Audience', icon: Users },
  { id: 2, title: 'Message', icon: MessageSquare },
  { id: 3, title: 'Review', icon: CheckCircle },
];

export const SMSCampaignWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { personas, loading: personasLoading } = useCRMPersonas();

  const [currentStep, setCurrentStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [selectAllSubscribers, setSelectAllSubscribers] = useState(false);
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  
  const [segments, setSegments] = useState<CRMSegment[]>([]);
  const [targetCustomers, setTargetCustomers] = useState<CRMCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [showRecipientsPreview, setShowRecipientsPreview] = useState(false);

  // Load segments and customers
  useEffect(() => {
    if (!tenant) return;
    loadSegments();
    loadCustomers();
  }, [tenant]);

  // Recalculate target customers when selections change
  useEffect(() => {
    calculateTargetCustomers();
  }, [selectedSegments, selectedPersonas, selectAllSubscribers]);

  const loadSegments = async () => {
    try {
      setLoadingSegments(true);
      const { data, error } = await supabase
        .from('custom_segments')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedSegments: CRMSegment[] = (data || []).map(segment => ({
        id: segment.id,
        name: segment.name,
        description: segment.name,
        customer_count: segment.customer_count || 0,
        type: 'custom' as const
      }));

      setSegments(formattedSegments);
    } catch (error) {
      console.error('Error loading segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoadingSegments(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_customers')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .eq('sms_opt_in', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTargetCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const calculateTargetCustomers = async () => {
    if (!tenant) return;

    try {
      let query = supabase
        .from('crm_customers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('sms_opt_in', true)
        .not('phone', 'is', null); // Require phone number for SMS

      // If "All SMS Subscribers" is not selected, apply filtering
      if (!selectAllSubscribers) {
        const conditions = [];

        // Add segment filtering
        if (selectedSegments.length > 0) {
          // Get customers in selected segments
          const { data: segmentCustomers } = await supabase
            .from('customer_segments')
            .select('customer_id')
            .in('segment_id', selectedSegments);
          
          if (segmentCustomers && segmentCustomers.length > 0) {
            const customerIds = segmentCustomers.map(sc => sc.customer_id);
            query = query.in('id', customerIds);
          } else {
            setTargetCustomers([]);
            return;
          }
        }

        // Add persona filtering
        if (selectedPersonas.length > 0) {
          const selectedPersonaNames = personas
            .filter(p => selectedPersonas.includes(p.id))
            .map(p => p.persona_name);
          
          // Use OR condition for persona matching
          query = query.or(`persona_id.in.(${selectedPersonas.join(',')}),persona.in.("${selectedPersonaNames.join('","')}")`);
        }

        // If both segments and personas are selected, we need to intersect them
        if (selectedSegments.length > 0 && selectedPersonas.length > 0) {
          // This is more complex - we need to fetch both sets and intersect
          const segmentQuery = supabase
            .from('crm_customers')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('sms_opt_in', true)
            .not('phone', 'is', null);

          // Get segment customers
          const { data: segmentCustomers } = await supabase
            .from('customer_segments')
            .select('customer_id')
            .in('segment_id', selectedSegments);

          if (segmentCustomers && segmentCustomers.length > 0) {
            const customerIds = segmentCustomers.map(sc => sc.customer_id);
            const { data: allCustomers, error } = await segmentQuery
              .in('id', customerIds)
              .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter by personas
            const selectedPersonaNames = personas
              .filter(p => selectedPersonas.includes(p.id))
              .map(p => p.persona_name);

            const filteredCustomers = (allCustomers || []).filter(customer =>
              selectedPersonas.includes(customer.persona_id || '') ||
              selectedPersonaNames.includes(customer.persona || '')
            );

            setTargetCustomers(filteredCustomers);
            return;
          } else {
            setTargetCustomers([]);
            return;
          }
        }

        // No selections means no results when not using "All Subscribers"
        if (selectedSegments.length === 0 && selectedPersonas.length === 0) {
          setTargetCustomers([]);
          return;
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter out customers without valid phone numbers
      const validCustomers = (data || []).filter(customer => 
        customer.phone && customer.phone.trim().length > 0
      );
      
      setTargetCustomers(validCustomers);
    } catch (error) {
      console.error('Error calculating target customers:', error);
      setTargetCustomers([]);
    }
  };

  const handleSegmentToggle = (segmentId: string) => {
    setSelectedSegments(prev => 
      prev.includes(segmentId) 
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const handlePersonaToggle = (personaId: string) => {
    setSelectedPersonas(prev => {
      if (prev.includes(personaId)) {
        return prev.filter(id => id !== personaId);
      } else if (prev.length < 3) {
        return [...prev, personaId];
      } else {
        toast.error('You can select up to 3 personas for targeting');
        return prev;
      }
    });
  };

  const handleAllSubscribersToggle = (checked: boolean) => {
    setSelectAllSubscribers(checked);
    if (checked) {
      setSelectedSegments([]);
      setSelectedPersonas([]);
    }
  };

  const canProceedFromStep1 = () => {
    return selectAllSubscribers || selectedSegments.length > 0 || selectedPersonas.length > 0;
  };

  const getSelectedPersonaNames = () => {
    return personas
      .filter(p => selectedPersonas.includes(p.id))
      .map(p => p.persona_name);
  };

  const handleCreateCampaign = async () => {
    if (!user || !tenant) return;

    try {
      setLoading(true);

      const selectedPersonaNames = getSelectedPersonaNames();
      
      const { data, error } = await supabase
        .from('crm_sms_campaigns')
        .insert({
          tenant_id: tenant.id,
          user_id: user.id,
          name: campaignName,
          message,
          image_url: imageUrl || null,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          status: scheduledAt ? 'scheduled' : 'draft',
          scheduled_at: scheduledAt || null,
          targeting_persona_ids: selectedPersonas,
          targeting_persona_names: selectedPersonaNames,
          targeting_logic: 'any'
        })
        .select()
        .single();

      if (error) throw error;

      // Create campaign-segment relationships
      if (selectedSegments.length > 0) {
        const campaignSegments = selectedSegments.map(segmentId => ({
          campaign_id: data.id,
          segment_id: segmentId
        }));

        const { error: segmentError } = await supabase
          .from('campaign_segments')
          .insert(campaignSegments);

        if (segmentError) throw segmentError;
      }

      // Create campaign-persona relationships
      if (selectedPersonas.length > 0) {
        const campaignPersonas = selectedPersonas.map(personaId => ({
          campaign_id: data.id,
          persona_id: personaId
        }));

        const { error: personaError } = await supabase
          .from('campaign_personas')
          .insert(campaignPersonas);

        if (personaError) throw personaError;
      }

      toast.success('Campaign created successfully!');
      navigate('/sms');
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    } finally {
      setLoading(false);
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
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name..."
                className="mt-1"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5" />
                Target Audience
              </h3>

              {/* All Subscribers Option */}
              <div className="flex items-center space-x-3 p-4 border rounded-lg bg-card">
                <Checkbox
                  id="all-subscribers"
                  checked={selectAllSubscribers}
                  onCheckedChange={handleAllSubscribersToggle}
                />
                <div className="flex-1">
                  <Label htmlFor="all-subscribers" className="font-medium">
                    All SMS Subscribers
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Send to all customers who have opted in to SMS messages ({targetCustomers.length} customers)
                  </p>
                </div>
              </div>

              {!selectAllSubscribers && (
                <>
                  {/* Segments */}
                  {segments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Customer Segments</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {segments.map((segment) => (
                          <div key={segment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                              id={`segment-${segment.id}`}
                              checked={selectedSegments.includes(segment.id)}
                              onCheckedChange={() => handleSegmentToggle(segment.id)}
                            />
                            <div className="flex-1">
                              <Label htmlFor={`segment-${segment.id}`} className="font-medium">
                                {segment.name}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {segment.customer_count} customers
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personas */}
                  {personas.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Customer Personas
                        <Badge variant="outline" className="text-xs">Max 3</Badge>
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {personas.map((persona) => (
                          <div key={persona.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                              id={`persona-${persona.id}`}
                              checked={selectedPersonas.includes(persona.id)}
                              onCheckedChange={() => handlePersonaToggle(persona.id)}
                              disabled={!selectedPersonas.includes(persona.id) && selectedPersonas.length >= 3}
                            />
                            <div className="flex-1">
                              <Label htmlFor={`persona-${persona.id}`} className="font-medium">
                                {persona.persona_name}
                              </Label>
                              {persona.persona_description && (
                                <p className="text-sm text-muted-foreground">
                                  {persona.persona_description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Targeting Summary */}
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Selected Targeting</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRecipientsPreview(true)}
                        className="text-xs"
                        disabled={targetCustomers.length === 0}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Recipients
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {selectedSegments.length > 0 && (
                        <p className="text-sm">
                          <strong>Segments:</strong> {selectedSegments.length} selected
                        </p>
                      )}
                      {selectedPersonas.length > 0 && (
                        <p className="text-sm">
                          <strong>Personas:</strong> {getSelectedPersonaNames().join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          Estimated reach: {targetCustomers.length} customers
                        </p>
                        {targetCustomers.length === 0 && (selectedSegments.length > 0 || selectedPersonas.length > 0) && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            <span className="text-xs">No eligible recipients</span>
                          </div>
                        )}
                      </div>
                      {targetCustomers.length === 0 && (selectedSegments.length > 0 || selectedPersonas.length > 0) && (
                        <p className="text-xs text-muted-foreground">
                          Recipients need SMS opt-in and valid phone numbers
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="message">SMS Message</Label>
              <SMSComposer
                value={message}
                onChange={setMessage}
                imageUrl={imageUrl}
                onImageChange={setImageUrl}
                mediaUrls={mediaUrls}
                onMediaUrlsChange={setMediaUrls}
                enableMultiImage={true}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="scheduled-at">Schedule (Optional)</Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Leave empty to save as draft
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Campaign Summary</h3>
              
              <div className="grid gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Campaign Details</h4>
                  <p><strong>Name:</strong> {campaignName}</p>
                  <p><strong>Status:</strong> {scheduledAt ? 'Scheduled' : 'Draft'}</p>
                  {scheduledAt && (
                    <p><strong>Scheduled for:</strong> {new Date(scheduledAt).toLocaleString()}</p>
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Target Audience</h4>
                  {selectAllSubscribers ? (
                    <p>All SMS Subscribers ({targetCustomers.length} customers)</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedSegments.length > 0 && (
                        <p><strong>Segments:</strong> {selectedSegments.length} selected</p>
                      )}
                      {selectedPersonas.length > 0 && (
                        <p><strong>Personas:</strong> {getSelectedPersonaNames().join(', ')}</p>
                      )}
                      <p className="font-medium">Total reach: {targetCustomers.length} customers</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Message Preview</h4>
                  <div className="bg-muted p-3 rounded text-sm whitespace-pre-wrap">
                    {message}
                  </div>
                  {(imageUrl || mediaUrls.length > 0) && (
                    <p className="text-sm text-muted-foreground mt-2">
                      📎 {mediaUrls.length > 0 ? `${mediaUrls.length} images` : '1 image'} attached (MMS)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create SMS Campaign</h1>
        <p className="text-muted-foreground">
          Set up your SMS campaign with targeted messaging
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className={`flex items-center ${
              currentStep === step.id 
                ? 'text-primary' 
                : currentStep > step.id 
                  ? 'text-green-600' 
                  : 'text-muted-foreground'
            }`}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep === step.id 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : currentStep > step.id 
                    ? 'border-green-600 bg-green-600 text-white' 
                    : 'border-muted-foreground'
              }`}>
                <step.icon className="h-5 w-5" />
              </div>
              <span className="ml-2 font-medium">{step.title}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 ${
                currentStep > step.id ? 'bg-green-600' : 'bg-muted'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            Step {currentStep}: {STEPS.find(s => s.id === currentStep)?.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        
        <div className="flex gap-3">
          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={
                (currentStep === 1 && (!campaignName.trim() || !canProceedFromStep1() || targetCustomers.length === 0)) ||
                (currentStep === 2 && !message.trim())
              }
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleCreateCampaign}
              disabled={loading}
              className="min-w-32"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Recipients Preview Dialog */}
      <RecipientsPreview
        isOpen={showRecipientsPreview}
        onClose={() => setShowRecipientsPreview(false)}
        customers={targetCustomers}
      />
    </div>
  );
};
