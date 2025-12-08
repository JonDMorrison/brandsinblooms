import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Gift, 
  Calendar, 
  TrendingUp, 
  Star,
  ShoppingCart,
  UserPlus,
  Medal,
  Zap,
  AlertCircle,
  Plug,
  RefreshCw,
  BookOpen
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SquareGuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/integrations")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Integrations
        </Button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Plug className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Square Integration Guide</h1>
            <p className="text-muted-foreground">
              Complete setup guide for connecting Square POS with BloomSuite
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisites */}
      <Card className="p-6 border-l-4 border-l-primary">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-primary" />
          Prerequisites
        </h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>A Square account (Business account recommended for full features)</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Admin access to your Square account</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>At least one location configured in Square</span>
          </li>
        </ul>
      </Card>

      {/* Step-by-Step Setup */}
      <Card className="p-6 space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Step-by-Step Setup
        </h2>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Navigate to Integrations Hub</h3>
              <p className="text-sm text-muted-foreground">
                Go to <span className="font-medium text-foreground">Settings → Integrations</span> from the sidebar menu. 
                Find the "Square" card in the POS Integrations section.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Click "Connect Square"</h3>
              <p className="text-sm text-muted-foreground">
                Click the blue "Connect Square" button. A new window will open directing you to Square's authorization page.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Authorize BloomSuite</h3>
              <p className="text-sm text-muted-foreground">
                Log in to your Square account if prompted, then click <span className="font-medium text-foreground">"Allow"</span> to grant 
                BloomSuite access to your customer data, transactions, and loyalty information.
              </p>
              <div className="bg-muted/50 p-3 rounded-lg text-xs">
                <strong>Permissions granted:</strong> Customers (read), Orders (read), Loyalty (read), Merchants (read)
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              4
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Confirm Connection</h3>
              <p className="text-sm text-muted-foreground">
                The window will close automatically. You'll see a green checkmark and "Connected" status on the Square card.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              5
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Run Initial Sync</h3>
              <p className="text-sm text-muted-foreground">
                Click <span className="font-medium text-foreground">"Sync Now"</span> to pull your customers, sales history, and products from Square. 
                This may take a few minutes depending on your data volume.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* What Gets Synced */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-green-500" />
          What Gets Synced
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Customer Data</span>
                <p className="text-sm text-muted-foreground">Names, emails, phones, group memberships</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Purchase History</span>
                <p className="text-sm text-muted-foreground">Orders, amounts, dates, items purchased</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Marketing Preferences</span>
                <p className="text-sm text-muted-foreground">Email opt-in status from Square preferences</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Customer Groups → Tags</span>
                <p className="text-sm text-muted-foreground">Square groups become BloomSuite tags</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Customer Metrics</span>
                <p className="text-sm text-muted-foreground">Lifetime value, total spent, purchase dates</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <span className="font-medium">Products Catalog</span>
                <p className="text-sm text-muted-foreground">SKUs, names, prices, categories</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Data Mapping Table */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Customer Data Mapping</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Square Field</th>
                <th className="text-left py-2 font-semibold">BloomSuite Field</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="py-2 text-muted-foreground">given_name</td><td className="py-2">first_name</td></tr>
              <tr><td className="py-2 text-muted-foreground">family_name</td><td className="py-2">last_name</td></tr>
              <tr><td className="py-2 text-muted-foreground">email_address</td><td className="py-2">email</td></tr>
              <tr><td className="py-2 text-muted-foreground">phone_number</td><td className="py-2">phone</td></tr>
              <tr><td className="py-2 text-muted-foreground">group_ids</td><td className="py-2">tags (array)</td></tr>
              <tr><td className="py-2 text-muted-foreground">preferences.email_unsubscribed</td><td className="py-2">email_opt_in (inverted)</td></tr>
              <tr><td className="py-2 text-muted-foreground">birthday</td><td className="py-2">custom_fields.date_of_birth</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Real-Time Webhooks */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/5 to-transparent">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Real-Time Webhooks
        </h2>
        <p className="text-sm text-muted-foreground">
          When connected, Square sends real-time updates to BloomSuite. This means:
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
            <ShoppingCart className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-sm">Instant Purchase Detection</p>
              <p className="text-xs text-muted-foreground">Automations trigger immediately after checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
            <UserPlus className="h-5 w-5 text-blue-500" />
            <div>
              <p className="font-medium text-sm">New Customer Alerts</p>
              <p className="text-xs text-muted-foreground">Welcome sequences start automatically</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          No manual sync needed for new purchases — they flow automatically!
        </p>
      </Card>

      {/* Available Automation Triggers */}
      <Card className="p-6 space-y-6">
        <h2 className="text-xl font-semibold">Available Automation Triggers</h2>
        <div className="space-y-6">
          {/* First Purchase */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-500/10 rounded-lg">
                <Gift className="h-4 w-4 text-teal-500" />
              </div>
              <h3 className="font-semibold">First Purchase</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Triggers when a customer makes their very first purchase at your store
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Welcome thank-you messages</li>
                <li>Loyalty program invitations</li>
                <li>First-purchase discount for next visit</li>
              </ul>
            </div>
          </div>

          {/* Order Completed */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-green-500" />
              </div>
              <h3 className="font-semibold">Order Completed</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Fires for every completed purchase via webhook
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Order confirmation emails</li>
                <li>Product care tips based on items purchased</li>
                <li>Cross-sell recommendations</li>
              </ul>
            </div>
          </div>

          {/* Review Request */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Star className="h-4 w-4 text-yellow-500" />
              </div>
              <h3 className="font-semibold">Review Request</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Automatically scheduled 5 days after a purchase
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Google review requests</li>
                <li>Product feedback collection</li>
                <li>Testimonial gathering</li>
              </ul>
            </div>
          </div>

          {/* Customer Created */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <UserPlus className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="font-semibold">Customer Created</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Triggers when a new customer profile is created in Square
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Welcome to the community messages</li>
                <li>First-time visitor offers</li>
                <li>Newsletter signups</li>
              </ul>
            </div>
          </div>

          {/* Loyalty Join */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Medal className="h-4 w-4 text-purple-500" />
              </div>
              <h3 className="font-semibold">Loyalty Join</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Fires when a customer joins your Square Loyalty program
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Welcome bonus notifications</li>
                <li>Program benefits explanation</li>
                <li>How to earn and redeem points</li>
              </ul>
            </div>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-pink-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-pink-500" />
              </div>
              <h3 className="font-semibold">Birthday</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Sends birthday messages when birthday is stored in customer profile
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Birthday discounts (20% off)</li>
                <li>Free item offers</li>
                <li>Special birthday surprises</li>
              </ul>
            </div>
          </div>

          {/* 90-Day Lapse */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <h3 className="font-semibold">90-Day Lapse</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Detects customers who haven't purchased in 90 days
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>"We miss you" messages with special offers</li>
                <li>Comeback discounts</li>
                <li>New product announcements</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Troubleshooting FAQ */}
      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Troubleshooting</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm">Connection failed or times out</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Ensure you're logging into the correct Square account with admin permissions. 
              Try clearing your browser cache and disabling popup blockers, then attempt the connection again.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-sm">Token expiry warning</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Square tokens expire after 30 days. BloomSuite automatically refreshes tokens, but if you see 
              an expiry warning, click "Reconnect" to re-authorize the connection.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-sm">Customers not syncing</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Only customers with an email address are synced. Ensure your Square customers have email addresses 
              associated with their profiles. Anonymous transactions won't create customer records.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger className="text-sm">Automations not triggering</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              Check that your automation is active (toggle ON). For real-time triggers like purchases, 
              ensure the webhook connection is working — you can test by making a small purchase.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-5">
            <AccordionTrigger className="text-sm">Sandbox vs Production environment</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              BloomSuite automatically detects your environment. Development environments use Square Sandbox, 
              while production uses live Square credentials. You can see the current environment on the connection card.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Pro Tips */}
      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Pro Tips
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• <strong>Tag your products</strong> in Square to enable plant care reminders and targeted campaigns</li>
          <li>• <strong>Collect customer birthdays</strong> at checkout to enable birthday automation</li>
          <li>• <strong>Use customer groups</strong> in Square — they'll sync as tags for segmentation</li>
          <li>• <strong>Set up a welcome automation</strong> for first-time buyers to boost repeat purchases</li>
          <li>• <strong>Enable review requests</strong> 5 days after purchase to boost your online reputation</li>
          <li>• <strong>Monitor the Analytics dashboard</strong> to see campaign performance and ROI</li>
        </ul>
      </Card>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
        <Button onClick={() => navigate("/integrations")} variant="outline">
          Return to Integrations
        </Button>
        <Button onClick={() => navigate("/crm/automations/new")}>
          Set Up Your First Automation
        </Button>
      </div>
    </div>
  );
};

export default SquareGuidePage;
