import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ExternalLink, 
  Key, 
  Store, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Users,
  ShoppingCart,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface POSSetupWizardProps {
  platform: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface StepProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  children: React.ReactNode;
}

const WizardStep: React.FC<StepProps> = ({ stepNumber, totalSteps, title, description, children }) => (
  <div className="space-y-6">
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">Step {stepNumber} of {totalSteps}</Badge>
        <span className="text-sm text-muted-foreground">{Math.round((stepNumber / totalSteps) * 100)}% Complete</span>
      </div>
      <Progress value={(stepNumber / totalSteps) * 100} className="w-full" />
    </div>
    
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    
    {children}
  </div>
);

export const POSSetupWizard: React.FC<POSSetupWizardProps> = ({
  platform,
  onSuccess,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connectionName, setConnectionName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; preview?: any } | null>(null);
  const { toast } = useToast();

  const platformConfig = {
    shopify: {
      title: 'Shopify',
      icon: <Store className="h-6 w-6 text-green-600" />,
      description: 'Connect your Shopify store to automatically sync customer data, order history, and inventory information.',
      benefits: [
        'Automatic customer sync',
        'Order history tracking',
        'Real-time inventory updates',
        'Customer behavior insights'
      ],
      fields: [
        { key: 'shop_domain', label: 'Shop Domain', placeholder: 'your-shop.myshopify.com', type: 'text', 
          help: 'Your Shopify store URL (without https://)' },
        { key: 'access_token', label: 'Private App Access Token', placeholder: 'shpat_...', type: 'password',
          help: 'Access token from your private app settings' },
      ],
      helpLink: 'https://help.shopify.com/en/manual/apps/private-apps',
      setupInstructions: [
        'Go to your Shopify Admin panel',
        'Navigate to Apps → Develop apps → Create private app',
        'Configure scopes: read_customers, read_orders',
        'Generate access token and copy it here'
      ]
    },
    square: {
      title: 'Square',
      icon: <div className="h-6 w-6 bg-blue-600 rounded" />,
      description: 'Connect your Square POS to sync customer transactions, payment data, and customer profiles.',
      benefits: [
        'Transaction history sync',
        'Customer payment preferences',
        'Sales analytics integration',
        'Inventory management'
      ],
      fields: [
        { key: 'application_id', label: 'Application ID', placeholder: 'sandbox-sq0idb-...', type: 'text',
          help: 'Your Square application ID from the developer dashboard' },
        { key: 'access_token', label: 'Access Token', placeholder: 'EAAAEOurQbdhG8Q...', type: 'password',
          help: 'Personal access token or OAuth token' },
        { key: 'environment', label: 'Environment', placeholder: 'sandbox or production', type: 'text',
          help: 'Use "sandbox" for testing, "production" for live data' },
      ],
      helpLink: 'https://developer.squareup.com/docs/build-basics/access-tokens',
      setupInstructions: [
        'Visit Square Developer Dashboard',
        'Create a new application or select existing',
        'Generate access token with required permissions',
        'Copy application ID and access token'
      ]
    },
    vmx: {
      title: 'VMX / CSV Upload',
      icon: <div className="h-6 w-6 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">CSV</div>,
      description: 'Upload customer data directly from CSV files for systems without API access.',
      benefits: [
        'Flexible data import',
        'One-time or recurring uploads',
        'Custom field mapping',
        'Batch processing'
      ],
      fields: [],
      helpLink: '#',
      setupInstructions: [
        'Export customer data from your POS system',
        'Format as CSV with headers',
        'Upload file for processing',
        'Review and confirm import'
      ]
    }
  };

  const config = platformConfig[platform as keyof typeof platformConfig];
  const totalSteps = config.fields.length > 0 ? 4 : 3; // Adjust for VMX which has no credential fields

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = () => {
    if (currentStep === 2 && !connectionName.trim()) {
      toast({
        title: "Connection Name Required",
        description: "Please enter a name for this connection.",
        variant: "destructive",
      });
      return false;
    }

    if (currentStep === 3 && config.fields.length > 0) {
      const missingFields = config.fields.filter(field => !credentials[field.key]?.trim());
      if (missingFields.length > 0) {
        toast({
          title: "Missing Credentials",
          description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const testConnection = async () => {
    if (!validateStep()) return;

    setIsConnecting(true);
    setTestResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create temporary connection for testing
      const { data, error } = await supabase
        .from('pos_connections')
        .insert({
          name: connectionName,
          platform,
          credentials_encrypted: JSON.stringify(credentials),
          settings: {},
          is_active: false, // Mark as inactive during testing
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Test the connection
      const { data: testData, error: testError } = await supabase.functions.invoke(`${platform}-sync`, {
        body: { 
          connection_id: data.id,
          test_only: true 
        }
      });

      if (testError) {
        await supabase.from('pos_connections').delete().eq('id', data.id);
        setTestResult({
          success: false,
          message: `Connection test failed: ${testError.message}`
        });
      } else {
        // Update connection as active
        await supabase
          .from('pos_connections')
          .update({ is_active: true })
          .eq('id', data.id);

        setTestResult({
          success: true,
          message: 'Connection successful! Preview data loaded.',
          preview: testData
        });
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to test connection."
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
  };

  if (!config) return null;

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            Connect {config.title}
          </DialogTitle>
          <DialogDescription>
            Follow the setup wizard to connect your {config.title} system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Platform Overview */}
          {currentStep === 1 && (
            <WizardStep
              stepNumber={1}
              totalSteps={totalSteps}
              title="Platform Overview"
              description={`Learn about connecting ${config.title} to your CRM`}
            >
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">What you'll get</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {config.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {config.fields.length > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Setup Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="space-y-2">
                        {config.setupInstructions.map((instruction, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-sm">{instruction}</span>
                          </li>
                        ))}
                      </ol>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <a href={config.helpLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Setup Guide
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </WizardStep>
          )}

          {/* Step 2: Connection Name */}
          {currentStep === 2 && (
            <WizardStep
              stepNumber={2}
              totalSteps={totalSteps}
              title="Name Your Connection"
              description="Give this connection a memorable name for easy identification"
            >
              <div className="space-y-4">
                <Label htmlFor="connection-name">Connection Name</Label>
                <Input
                  id="connection-name"
                  placeholder={`My ${config.title} Store`}
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear in your connections list and sync reports.
                </p>
              </div>
            </WizardStep>
          )}

          {/* Step 3: Credentials (if needed) */}
          {currentStep === 3 && config.fields.length > 0 && (
            <WizardStep
              stepNumber={3}
              totalSteps={totalSteps}
              title="Enter Credentials"
              description="Provide the authentication details for your POS system"
            >
              <div className="space-y-4">
                {config.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="flex items-center gap-1">
                      {field.label}
                      {field.type === 'password' && <Key className="h-3 w-3" />}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={credentials[field.key] || ''}
                      onChange={(e) => setCredentials(prev => ({
                        ...prev,
                        [field.key]: e.target.value
                      }))}
                      className="text-base"
                    />
                    {field.help && (
                      <p className="text-xs text-muted-foreground">{field.help}</p>
                    )}
                  </div>
                ))}
              </div>
            </WizardStep>
          )}

          {/* Step 4: Test & Complete */}
          {currentStep === totalSteps && (
            <WizardStep
              stepNumber={totalSteps}
              totalSteps={totalSteps}
              title="Test Connection"
              description="Verify your connection and complete the setup"
            >
              <div className="space-y-4">
                {!testResult && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center space-y-3">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                          <Store className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Ready to Test Connection</h4>
                          <p className="text-sm text-muted-foreground">
                            We'll verify your credentials and fetch sample data
                          </p>
                        </div>
                        <Button onClick={testConnection} disabled={isConnecting} className="w-full">
                          {isConnecting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Testing Connection...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {testResult && (
                  <Card className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {testResult.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <h4 className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                            {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                          </h4>
                          <p className={`text-sm ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {testResult.message}
                          </p>
                          
                          {testResult.success && testResult.preview && (
                            <div className="mt-3 grid grid-cols-2 gap-4">
                              <div className="text-center p-2 bg-white rounded border">
                                <Users className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                                <div className="text-sm font-medium">{testResult.preview.customers || 0}</div>
                                <div className="text-xs text-muted-foreground">Customers</div>
                              </div>
                              <div className="text-center p-2 bg-white rounded border">
                                <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-green-600" />
                                <div className="text-sm font-medium">{testResult.preview.orders || 0}</div>
                                <div className="text-xs text-muted-foreground">Orders</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </WizardStep>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? onCancel : handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            {currentStep < totalSteps ? (
              <Button
                onClick={() => {
                  if (validateStep()) {
                    handleNext();
                  }
                }}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!testResult?.success}
                className="flex items-center gap-2"
              >
                Complete Setup
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};