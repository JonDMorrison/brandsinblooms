import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui-legacy/accordion';

export default function GuidePage() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/integrations/pos">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Clover Integration Guide</h1>
          <p className="text-muted-foreground">
            Learn how to connect and use your Clover POS integration
          </p>
        </div>
      </div>

      {/* Getting Started */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold mb-2">Getting Started</h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                The Clover integration connects your point-of-sale data with BloomSuite, 
                enabling you to sync customers, track purchases, and automate marketing campaigns.
              </p>
              
              <div className="grid gap-3 mt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Automatic Customer Sync</p>
                    <p>Customer profiles from Clover sync automatically with your CRM.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Purchase History</p>
                    <p>Track customer purchase history to create targeted marketing campaigns.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Product Catalog</p>
                    <p>Your product inventory syncs for personalized recommendations.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Setup Instructions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Setup Instructions</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Create a Clover Developer Account</p>
              <p className="text-sm text-muted-foreground mt-1">
                If you haven't already, create a developer account at the Clover Developer Portal.
              </p>
              <Button variant="link" className="p-0 h-auto mt-2" asChild>
                <a href="https://sandbox.dev.clover.com" target="_blank" rel="noopener noreferrer">
                  Open Clover Developer Portal
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
          
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Connect Your Account</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "Connect Clover" on the POS Integrations page and authorize BloomSuite 
                to access your Clover data.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Complete the Setup Wizard</p>
              <p className="text-sm text-muted-foreground mt-1">
                After connecting, the setup wizard will sync your data and help you configure 
                automated marketing campaigns.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="data-sync">
            <AccordionTrigger>How often does data sync?</AccordionTrigger>
            <AccordionContent>
              Data syncs automatically when you click "Sync Now" from the integration panel. 
              Future updates will include real-time webhooks for instant data updates when 
              purchases occur in Clover.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="what-syncs">
            <AccordionTrigger>What data is synced from Clover?</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc list-inside space-y-1">
                <li>Customer names, emails, and phone numbers</li>
                <li>Marketing preferences and opt-in status</li>
                <li>Purchase history and order details</li>
                <li>Product catalog with categories</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="regions">
            <AccordionTrigger>Which Clover regions are supported?</AccordionTrigger>
            <AccordionContent>
              BloomSuite supports Clover merchants in North America (US), Europe, and Latin America. 
              The integration automatically detects your region during the OAuth flow.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="disconnect">
            <AccordionTrigger>How do I disconnect my Clover account?</AccordionTrigger>
            <AccordionContent>
              Click the "Disconnect" button on the Clover integration card. This will remove 
              the connection but won't delete any previously synced customer data from your CRM.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Troubleshooting */}
      <Card className="p-6 border-yellow-500/20 bg-yellow-50/5">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold mb-2">Troubleshooting</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Connection timeout:</strong> If the OAuth flow times out, try again. 
                Make sure popup blockers are disabled for this site.
              </p>
              <p>
                <strong>Missing permissions:</strong> Ensure your Clover account has the necessary 
                permissions to access customer and order data.
              </p>
              <p>
                <strong>Sync errors:</strong> If syncing fails, try running the sync again. 
                For persistent issues, contact support.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
