import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ExternalLink, 
  Video, 
  FileText, 
  MessageCircle, 
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock
} from 'lucide-react';

interface POSConnectionHelpProps {
  platform: string;
}

export const POSConnectionHelp: React.FC<POSConnectionHelpProps> = ({ platform }) => {
  const helpContent = {
    shopify: {
      title: 'Shopify Connection Guide',
      estimatedTime: '5-10 minutes',
      difficulty: 'Easy',
      videoUrl: 'https://www.youtube.com/watch?v=shopify-setup',
      steps: [
        {
          title: 'Access Your Shopify Admin',
          description: 'Log into your Shopify store admin panel',
          details: 'Go to your-store.myshopify.com/admin'
        },
        {
          title: 'Create a Private App',
          description: 'Navigate to Apps → Develop apps → Create private app',
          details: 'You need admin permissions to create private apps'
        },
        {
          title: 'Configure Permissions',
          description: 'Enable the following scopes:',
          details: '• read_customers (Access customer data)\n• read_orders (Access order history)\n• read_products (Optional: Product catalog)'
        },
        {
          title: 'Generate Access Token',
          description: 'Create and copy your access token',
          details: 'Keep this token secure - treat it like a password'
        }
      ],
      troubleshooting: [
        {
          issue: 'Invalid shop domain',
          solution: 'Ensure you enter just the domain (e.g., my-store.myshopify.com) without https://'
        },
        {
          issue: 'Access token authentication failed',
          solution: 'Verify your token starts with "shpat_" and has the correct permissions'
        },
        {
          issue: 'No customers found',
          solution: 'Check that your store has customers and the read_customers scope is enabled'
        }
      ]
    },
    square: {
      title: 'Square Connection Guide',
      estimatedTime: '10-15 minutes',
      difficulty: 'Medium',
      videoUrl: 'https://www.youtube.com/watch?v=square-setup',
      steps: [
        {
          title: 'Access Square Developer Dashboard',
          description: 'Visit developer.squareup.com and sign in',
          details: 'Use your Square account credentials'
        },
        {
          title: 'Create or Select Application',
          description: 'Create a new app or select an existing one',
          details: 'Give your app a descriptive name for easy identification'
        },
        {
          title: 'Generate Access Token',
          description: 'Create a production or sandbox access token',
          details: 'Use sandbox for testing, production for live data'
        },
        {
          title: 'Configure Permissions',
          description: 'Ensure your app has the required permissions:',
          details: '• CUSTOMERS_READ\n• ORDERS_READ\n• PAYMENTS_READ'
        }
      ],
      troubleshooting: [
        {
          issue: 'Application ID not found',
          solution: 'Copy the Application ID from your Square Developer Dashboard exactly'
        },
        {
          issue: 'Access token expired',
          solution: 'Generate a new access token - they expire regularly for security'
        },
        {
          issue: 'Permission denied errors',
          solution: 'Verify your app has the required scopes enabled in the Square dashboard'
        }
      ]
    },
    vmx: {
      title: 'VMX / CSV Upload Guide',
      estimatedTime: '5 minutes',
      difficulty: 'Easy',
      videoUrl: null,
      steps: [
        {
          title: 'Export Your Data',
          description: 'Export customer data from your POS system',
          details: 'Most POS systems have an export feature in Reports or Settings'
        },
        {
          title: 'Format Your CSV',
          description: 'Ensure your CSV has the required columns:',
          details: '• name or first_name + last_name\n• email (required)\n• phone (optional)\n• Any custom fields'
        },
        {
          title: 'Upload File',
          description: 'Use the file upload feature to import your data',
          details: 'Files up to 10MB are supported'
        },
        {
          title: 'Review & Confirm',
          description: 'Review the preview and confirm the import',
          details: 'You can map columns if they don\'t match exactly'
        }
      ],
      troubleshooting: [
        {
          issue: 'CSV format not recognized',
          solution: 'Ensure your file is saved as .csv with comma separators'
        },
        {
          issue: 'Missing email addresses',
          solution: 'Email is required for each customer record'
        },
        {
          issue: 'Duplicate customers',
          solution: 'Duplicates are automatically merged based on email address'
        }
      ]
    }
  };

  const content = helpContent[platform as keyof typeof helpContent];
  
  if (!content) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {content.title}
            <div className="flex gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {content.estimatedTime}
              </Badge>
              <Badge variant={content.difficulty === 'Easy' ? 'default' : 'secondary'}>
                {content.difficulty}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Complete setup guide for connecting your {platform.toUpperCase()} system
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="steps" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="steps">Setup Steps</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="space-y-4">
          <div className="space-y-4">
            {content.steps.map((step, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.details && (
                        <div className="text-xs bg-muted p-2 rounded whitespace-pre-line">
                          {step.details}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-4">
          <div className="space-y-4">
            {content.troubleshooting.map((item, index) => (
              <Card key={index} className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-medium text-orange-900">{item.issue}</h4>
                      <p className="text-sm text-orange-700">{item.solution}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {content.videoUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Video Tutorial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Watch a step-by-step video guide
                  </p>
                  <Button size="sm" asChild>
                    <a href={content.videoUrl} target="_blank" rel="noopener noreferrer">
                      <Video className="h-4 w-4 mr-1" />
                      Watch Video
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Official platform documentation
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={`#${platform}-docs`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Docs
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Get support from our team
                </p>
                <Button variant="outline" size="sm">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Best Practices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Test with sandbox first
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Keep credentials secure
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Regular sync schedule
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};