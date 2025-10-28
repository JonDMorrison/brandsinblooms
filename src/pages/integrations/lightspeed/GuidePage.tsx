import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, Tag, Gift, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/integrations")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Integrations
      </Button>

      <div>
        <h1 className="text-3xl font-bold mb-2">Lightspeed Integration Guide</h1>
        <p className="text-muted-foreground">
          Learn how to make the most of your Lightspeed Retail POS integration with BloomSuite
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          What Gets Tracked
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Customer Data</span> - Names, emails, phone numbers, and loyalty balances
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Purchase History</span> - All completed sales with transaction details
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Product Catalog</span> - Product names, SKUs, prices, and inventory levels
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Customer Groups</span> - Automatically mapped to CRM segments
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Loyalty Programs</span> - Points balances and membership status
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Available Automation Triggers</h2>
        <div className="space-y-6">
          {/* First Purchase */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">First Purchase Trigger</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Automatically welcomes new customers 60 minutes after their first POS transaction
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Thank you messages</li>
                <li>Loyalty program invitations</li>
                <li>First-purchase discount for next visit</li>
              </ul>
            </div>
          </div>

          {/* 90-Day Lapse */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <h3 className="font-semibold">90-Day Lapse Trigger</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Detects customers who haven't purchased in 90 days and triggers win-back campaigns
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>"We miss you" messages with special offers</li>
                <li>Comeback discounts (20% off)</li>
                <li>New product announcements</li>
              </ul>
            </div>
          </div>

          {/* Loyalty Join */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <h3 className="font-semibold">Loyalty Join Trigger</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Fires when a customer joins your loyalty program at the POS
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

          {/* Plant Care Reminder */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Tag className="h-4 w-4 text-green-500" />
              </div>
              <h3 className="font-semibold">Plant Care Reminder (Tag-Based)</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Triggered by product tags (e.g., "tomato", "rose") and sends care tips 10 days after purchase
            </p>
            <div className="ml-10 text-sm">
              <span className="font-medium">Perfect for:</span>
              <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                <li>Watering and care reminders</li>
                <li>Fertilizer recommendations</li>
                <li>Seasonal care tips</li>
              </ul>
            </div>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-pink-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-pink-500" />
              </div>
              <h3 className="font-semibold">Birthday Trigger</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Sends birthday messages when the birth_date field is populated in customer profile
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
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Setup Instructions</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-[32px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <span className="font-medium">Complete OAuth Connection</span>
              <p className="text-muted-foreground">
                If you see "Connected" on the integrations page, you're all set!
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[32px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <span className="font-medium">Run Initial Sync</span>
              <p className="text-muted-foreground">
                Click "Sync Now" to pull your customer data, purchase history, and product catalog
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[32px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <span className="font-medium">Create Automations</span>
              <p className="text-muted-foreground">
                Go to Automations and set up campaigns using the triggers above
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[32px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              4
            </div>
            <div>
              <span className="font-medium">Monitor Performance</span>
              <p className="text-muted-foreground">
                Check your Analytics dashboard to see campaign performance and ROI
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">💡 Pro Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Tag your products in Lightspeed to enable plant care reminders</li>
          <li>• Collect customer birthdays at checkout to enable birthday campaigns</li>
          <li>• Run daily syncs to keep your data fresh (automatic after initial setup)</li>
          <li>• Use customer segments to target specific groups with tailored messages</li>
        </ul>
      </Card>

      <div className="flex justify-center pt-4">
        <Button onClick={() => navigate("/integrations")}>
          Return to Integrations
        </Button>
      </div>
    </div>
  );
};

export default GuidePage;
