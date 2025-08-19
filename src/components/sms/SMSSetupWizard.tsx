import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Smartphone, TestTube, Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { twilioClient } from '@/lib/sms/twilioClient';

interface SMSSetupWizardProps {
  trigger: React.ReactNode;
  onComplete: () => void;
}

export const SMSSetupWizard: React.FC<SMSSetupWizardProps> = ({ trigger, onComplete }) => {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  const steps = [
    {
      id: 'connect',
      title: 'Connect Twilio',
      description: 'Link your Twilio account for SMS functionality',
      icon: Smartphone,
      completed: true // Assume this is completed if wizard is accessible
    },
    {
      id: 'test',
      title: 'Test SMS',
      description: 'Send a test message to verify everything works',
      icon: TestTube,
      completed: false
    },
    {
      id: 'compliance',
      title: 'Compliance Setup',
      description: 'Configure opt-out keywords and compliance settings',
      icon: Shield,
      completed: false
    }
  ];

  const handleTestSMS = async () => {
    if (!testPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    setTesting(true);
    try {
      await twilioClient.sendSMS({
        to: testPhone,
        body: 'Welcome to SMS campaigns! This is a test message from your new setup. Reply STOP to opt out.'
      });
      
      toast.success('Test message sent successfully!');
      steps[1].completed = true;
      setCurrentStep(2);
    } catch (error) {
      console.error('Test SMS failed:', error);
      toast.error('Failed to send test message. Please check your phone number.');
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = () => {
    toast.success('SMS setup completed! You can now create campaigns.');
    setOpen(false);
    onComplete();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Twilio Connected</p>
                <p className="text-sm text-green-700">Your Twilio credentials are configured and ready</p>
              </div>
            </div>
            <Button onClick={() => setCurrentStep(1)} className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue to Testing
            </Button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-phone">Test Phone Number</Label>
              <Input
                id="test-phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll send a test message to verify your setup
              </p>
            </div>
            <Button 
              onClick={handleTestSMS} 
              disabled={testing || !testPhone}
              className="w-full"
            >
              <TestTube className="h-4 w-4 mr-2" />
              {testing ? 'Sending Test...' : 'Send Test Message'}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">Opt-out Keywords</span>
                <Badge variant="outline">STOP, QUIT, CANCEL</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">Quiet Hours</span>
                <Badge variant="outline">10 PM - 8 AM</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">Rate Limiting</span>
                <Badge variant="outline">1 msg/sec</Badge>
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Compliance Note:</strong> Your SMS campaigns will automatically handle opt-outs and respect quiet hours. 
              Always include opt-out instructions in your messages.
            </p>
            </div>
            <Button onClick={handleComplete} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete Setup
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>SMS Setup Wizard</DialogTitle>
          <DialogDescription>
            Let's get your SMS campaigns ready in just a few steps
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                index === currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {step.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  React.createElement(step.icon, { className: "h-4 w-4" })
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-0.5 ml-2 ${
                  step.completed ? 'bg-green-200' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {React.createElement(steps[currentStep].icon, { className: "h-5 w-5" })}
              <span>{steps[currentStep].title}</span>
            </CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStep()}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};