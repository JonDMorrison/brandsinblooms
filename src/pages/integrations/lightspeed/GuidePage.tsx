import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Tag,
  Gift,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const plannedBadgeClassName =
  "rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800";

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
        <h1 className="text-3xl font-bold mb-2">
          Lightspeed Integration Guide
        </h1>
        <p className="text-muted-foreground">
          Legacy guide for the Lightspeed Retail POS integration. Use the
          current dashboard and documentation for the latest implementation
          status.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50 p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={plannedBadgeClassName}>Planning Update</span>
            <span className="text-sm font-medium text-amber-900">
              This page is preserved for bookmarked users.
            </span>
          </div>
          <p className="text-sm text-amber-900">
            Lightspeed connection, sync visibility, and diagnostics now live in
            the main integration shell. The automation examples below are
            planning references, not shipped trigger guarantees.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/integrations/lightspeed")}
            >
              Open Lightspeed Dashboard
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/integrations/lightspeed/documentation")}
            >
              Open Lightspeed Documentation
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          What Gets Tracked
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Customer Data</span> - Names,
              emails, phone numbers, and loyalty balances
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Purchase History</span> - All
              completed sales with transaction details
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Product Catalog</span> - Product
              names, SKUs, prices, and inventory levels
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Customer Groups</span> -
              Automatically mapped to CRM segments
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[24px]">✅</div>
            <div>
              <span className="font-medium">Loyalty Programs</span> - Points
              balances and membership status
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold">Planned Automation Triggers</h2>
        <div className="space-y-6">
          {/* First Purchase */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">First Purchase Trigger</h3>
              <span className={plannedBadgeClassName}>Planned</span>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Planned welcome automation for customers after their first synced
              POS transaction.
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
              <span className={plannedBadgeClassName}>Planned</span>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Planned win-back automation for customers who have not purchased
              in 90 days.
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
              <span className={plannedBadgeClassName}>Planned</span>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Planned automation for loyalty enrollment events captured through
              Lightspeed.
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
              <span className={plannedBadgeClassName}>Planned</span>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Planned tag-driven follow-up once Lightspeed product tagging and
              automation routing reach parity.
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
              <span className={plannedBadgeClassName}>Planned</span>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              Planned birthday automation when Lightspeed profile data and
              trigger delivery are fully wired.
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
                Click "Sync Now" to pull your customer data, purchase history,
                and product catalog
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="min-w-[32px] h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <span className="font-medium">
                Track Planned Automation Readiness
              </span>
              <p className="text-muted-foreground">
                Use the Lightspeed dashboard and documentation to monitor
                current sync behavior while these automation triggers remain in
                planning.
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
                Check your Analytics dashboard to see campaign performance and
                ROI
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="font-semibold mb-2">💡 Pro Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • Use the Lightspeed dashboard to verify customer, sales, and
            product sync status before planning campaigns.
          </li>
          <li>
            • Treat the trigger examples above as roadmap references until the
            implementation is marked live in the main integration shell.
          </li>
          <li>
            • Keep customer emails clean in Lightspeed so CRM normalization can
            link synced customers reliably.
          </li>
          <li>
            • Check the documentation route for the latest operational notes and
            rollout status.
          </li>
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
