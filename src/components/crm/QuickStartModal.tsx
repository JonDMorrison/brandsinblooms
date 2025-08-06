import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Target, 
  Mail, 
  CheckCircle, 
  Upload, 
  X,
  ArrowRight,
  Sparkles,
  Phone
} from 'lucide-react';

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerCount: number;
  segmentCount: number;
  campaignCount: number;
  onStepComplete: () => void;
  isFirstTimeOnboarding?: boolean;
  onOnboardingComplete?: () => void;
}

interface QuickAddCustomerForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  persona: string;
}

const STORAGE_KEY = 'quickstart_progress';

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  isOpen,
  onClose,
  customerCount,
  segmentCount,
  campaignCount,
  onStepComplete,
  isFirstTimeOnboarding = false,
  onOnboardingComplete
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(isFirstTimeOnboarding ? -1 : 0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddCustomerForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    persona: 'newbie'
  });

  // Calculate completion status
  const steps = [
    {
      icon: Users,
      title: "Import Your Customers",
      description: "Upload a CSV or add a few customers manually to start building your list.",
      isComplete: customerCount > 0,
      actions: [
        { type: 'primary', label: 'Add Customer Manually', action: () => setIsAddingCustomer(true) },
        { type: 'secondary', label: 'Upload CSV', action: () => navigate('/crm/customers') }
      ]
    },
    {
      icon: Target,
      title: "Create a Segment",
      description: "Group customers into Personas like Newbie, Plant Killer, Regular, or Expert.",
      isComplete: segmentCount > 0,
      actions: [
        { type: 'primary', label: 'Create My First Segment', action: createQuickSegment },
        { type: 'secondary', label: 'Advanced Segments', action: () => navigate('/crm/segments') }
      ]
    },
    {
      icon: Mail,
      title: "Send Your First Campaign",
      description: "Use our templates to send your first email or SMS to connect with customers.",
      isComplete: campaignCount > 0,
      actions: [
        { type: 'primary', label: 'Create Email Campaign', action: () => navigate('/crm/campaigns/new') },
        { type: 'secondary', label: 'Create SMS Campaign', action: () => navigate('/crm/sms/new') }
      ]
    }
  ];

  const completedSteps = steps.filter(step => step.isComplete).length;
  const progress = (completedSteps / steps.length) * 100;

  useEffect(() => {
    // Load saved progress
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      const { completed } = JSON.parse(savedProgress);
      if (completed === steps.length) {
        setShowSuccess(true);
      }
    }
  }, []);

  useEffect(() => {
    // Save progress
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completed: completedSteps,
      timestamp: Date.now()
    }));

    // Check if all steps are complete
    if (completedSteps === steps.length && !showSuccess) {
      setShowSuccess(true);
      if (isFirstTimeOnboarding && onOnboardingComplete) {
        onOnboardingComplete();
      }
    }
  }, [completedSteps]);

  async function createQuickSegment() {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      const segmentData = {
        name: "New Garden Enthusiasts",
        description: "Customers who are new to gardening and need guidance",
        conditions: [{ field: 'persona', operator: 'equals', value: 'newbie' }],
        customer_count: 0,
        auto_update: true,
        tenant_id: userData.tenant_id,
        user_id: user?.id
      };

      const { error } = await supabase
        .from('crm_segments')
        .insert(segmentData);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your first segment has been created"
      });

      onStepComplete();
      setCurrentStep(2); // Move to next step
    } catch (error) {
      console.error('Error creating segment:', error);
      toast({
        title: "Error",
        description: "Failed to create segment",
        variant: "destructive"
      });
    }
  }

  async function addQuickCustomer() {
    if (!quickAddForm.email || !quickAddForm.first_name) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a name and email",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!userData?.tenant_id) return;

      const { error } = await supabase
        .from('crm_customers')
        .insert({
          ...quickAddForm,
          tenant_id: userData.tenant_id,
          user_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "Customer Added!",
        description: `${quickAddForm.first_name} has been added to your customer list`
      });

      // Reset form
      setQuickAddForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        persona: 'newbie'
      });
      
      setIsAddingCustomer(false);
      onStepComplete();
      setCurrentStep(1); // Move to next step
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer",
        variant: "destructive"
      });
    }
  }

  function handleClose() {
    setShowSuccess(false);
    setIsAddingCustomer(false);
    onClose();
  }

  function skipToNextStep() {
    const nextIncompleteStep = steps.findIndex(step => !step.isComplete);
    if (nextIncompleteStep !== -1) {
      setCurrentStep(nextIncompleteStep);
    }
  }

  // Success screen
  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md" aria-describedby="setup-success-desc">
          <p id="setup-success-desc" className="sr-only">Setup completed successfully. Your CRM is ready to use.</p>
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              🌼 You're Ready to Grow!
            </h2>
            <p className="text-muted-foreground mb-6">
              Congratulations! Your CRM is set up and ready to help you build stronger customer relationships.
            </p>
            <div className="space-y-3">
              <Button onClick={handleClose} className="w-full" size="lg">
                {isFirstTimeOnboarding ? 'Start Growing!' : 'Go to CRM Dashboard'}
              </Button>
              {!isFirstTimeOnboarding && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowSuccess(false)}
                  className="w-full"
                >
                  View Setup Again
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Quick add customer form
  if (isAddingCustomer) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md" aria-describedby="add-customer-desc">
          <p id="add-customer-desc" className="sr-only">Form to add your first customer to the CRM system.</p>
          <DialogHeader>
            <DialogTitle>Add Your First Customer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input
                  value={quickAddForm.first_name}
                  onChange={(e) => setQuickAddForm(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={quickAddForm.last_name}
                  onChange={(e) => setQuickAddForm(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={quickAddForm.email}
                onChange={(e) => setQuickAddForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            
            <div>
              <Label>Phone (optional)</Label>
              <Input
                value={quickAddForm.phone}
                onChange={(e) => setQuickAddForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            
            <div>
              <Label>Gardening Experience</Label>
              <NativeSelect
                value={quickAddForm.persona} 
                onChange={(e) => setQuickAddForm(prev => ({ ...prev, persona: e.target.value }))}
                options={[
                  { value: 'newbie', label: '🌱 Newbie - Just getting started' },
                  { value: 'struggler', label: '🥀 Struggler - Has challenges' },
                  { value: 'regular', label: '🌿 Regular - Experienced gardener' },
                  { value: 'expert', label: '🌳 Expert - Master gardener' }
                ]}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button onClick={addQuickCustomer} className="flex-1">
                Add Customer
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAddingCustomer(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Welcome screen for first-time users
  if (currentStep === -1) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg" aria-describedby="welcome-desc">
          <p id="welcome-desc" className="sr-only">Welcome screen for BloomSuite CRM with overview of features and setup guide.</p>
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-green-800 mb-3">
              🌱 Welcome to BloomSuite CRM!
            </h2>
            <p className="text-muted-foreground mb-6 text-lg">
              Transform how you connect with customers through intelligent segmentation, 
              automated campaigns, and AI-powered content that grows your business.
            </p>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-green-800 mb-3">What you'll be able to do:</h3>
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Import and organize customer lists</span>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Create smart segments by gardening experience</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Send personalized email & SMS campaigns</span>
                </div>
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Use AI to generate seasonal content</span>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setCurrentStep(0)} 
              size="lg"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              Let's Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Main stepper modal
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="setup-guide-desc">
        <p id="setup-guide-desc" className="sr-only">Step-by-step setup guide for configuring your CRM system with customer data, segments, and campaigns.</p>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🌱 Let's Get You Set Up!
            {!isFirstTimeOnboarding && (
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
          <p className="text-muted-foreground">
            Set this up once and unlock powerful marketing automation for your garden center.
          </p>
        </DialogHeader>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{completedSteps} of {steps.length} complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = step.isComplete;
            
            return (
              <div 
                key={index}
                className={`border rounded-lg p-6 transition-all ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border'
                } ${isComplete ? 'border-green-200 bg-green-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                    isComplete 
                      ? 'bg-green-100 text-green-600' 
                      : isActive 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-semibold ${
                        isComplete ? 'text-green-700' : isActive ? 'text-primary' : 'text-foreground'
                      }`}>
                        {step.title}
                      </h3>
                      {isComplete && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          Complete
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-muted-foreground mb-4">
                      {step.description}
                    </p>
                    
                    {!isComplete && isActive && (
                      <div className="flex gap-2 flex-wrap">
                        {step.actions.map((action, actionIndex) => (
                          <Button
                            key={actionIndex}
                            variant={action.type === 'primary' ? 'default' : 'outline'}
                            size="sm"
                            onClick={action.action}
                          >
                            {action.label}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={skipToNextStep}>
            Skip for now
          </Button>
          <div className="text-sm text-muted-foreground">
            {completedSteps < steps.length ? (
              `${steps.length - completedSteps} steps remaining`
            ) : (
              'All steps complete! 🎉'
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};