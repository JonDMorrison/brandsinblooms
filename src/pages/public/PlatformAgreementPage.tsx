import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublicPageLayout } from "@/components/public/PublicPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

const AGREEMENT_NAME = "BloomSuite Platform Agreement";
const AGREEMENT_VERSION = "v1.0";

export const PlatformAgreementPage = () => {
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { companyInfo } = useCompanyInfo();

  // Check if user has already accepted this agreement
  useEffect(() => {
    const checkAcceptance = async () => {
      if (!user) {
        setHasAccepted(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_agreement_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("agreement_name", AGREEMENT_NAME)
        .eq("agreement_version", AGREEMENT_VERSION)
        .maybeSingle();

      if (error) {
        console.error("Error checking agreement acceptance:", error);
        setHasAccepted(false);
        return;
      }

      setHasAccepted(!!data);
    };

    checkAcceptance();
  }, [user]);

  const handleAccept = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to accept the agreement.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get user's IP address (via a public API)
      let ipAddress = "unknown";
      try {
        const ipResponse = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch {}

      // Get tenant_id from user metadata or company profile
      const tenantId = user.user_metadata?.tenant_id || null;

      const { error } = await supabase
        .from("user_agreement_acceptances")
        .insert({
          user_id: user.id,
          tenant_id: tenantId,
          business_name: companyInfo?.name || null,
          agreement_name: AGREEMENT_NAME,
          agreement_version: AGREEMENT_VERSION,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
        });

      if (error) throw error;

      toast({
        title: "Agreement Accepted",
        description:
          "Thank you for accepting the BloomSuite Platform Agreement.",
      });

      // Navigate to the next step in the website services signup
      navigate("/website-services/setup");
    } catch (error) {
      console.error("Error recording agreement acceptance:", error);
      toast({
        title: "Error",
        description: "Failed to record your acceptance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (hasAccepted === null) {
    return (
      <PublicPageLayout
        title="Platform Agreement"
        description="Review and accept the BloomSuite Platform Agreement to continue."
        canonicalPath="/platform-agreement"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Platform Agreement", url: "/platform-agreement" },
        ]}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PublicPageLayout>
    );
  }

  // Already accepted state
  if (hasAccepted) {
    return (
      <PublicPageLayout
        title="Platform Agreement"
        description="You have already accepted the BloomSuite Platform Agreement."
        canonicalPath="/platform-agreement"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Platform Agreement", url: "/platform-agreement" },
        ]}
      >
        <section className="py-12 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Agreement Already Accepted
            </h1>
            <p className="text-muted-foreground mb-8">
              You have already accepted the BloomSuite Platform Agreement (
              {AGREEMENT_VERSION}).
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        </section>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout
      title="Platform Agreement"
      description="Review and accept the BloomSuite Platform Agreement to access website services."
      canonicalPath="/platform-agreement"
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Platform Agreement", url: "/platform-agreement" },
      ]}
    >
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            BloomSuite Platform Agreement
          </h1>
          <p className="text-muted-foreground mb-8">
            Version {AGREEMENT_VERSION} • Effective Date: January 1, 2026
          </p>

          {/* Scrollable Agreement Content */}
          <Card className="mb-8">
            <CardContent className="p-6 max-h-[60vh] overflow-y-auto prose prose-slate max-w-none">
              {/* 1. Platform Services */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  1. Platform Services
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite is a software platform operated by Brands in Blooms
                  Inc. that provides garden centers with tools to sell products
                  online through their own branded websites. The platform
                  facilitates payment processing, fulfillment routing to
                  approved nursery partners, automated tax calculation, customer
                  relationship management, marketing automation, analytics
                  reporting, and human technical support. BloomSuite acts solely
                  as a technology provider and transaction facilitator.
                  BloomSuite does not own inventory, is not a party to sales
                  transactions, and does not control the products or services
                  offered by garden centers.
                </p>
              </section>

              {/* 2. Seller of Record */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  2. Seller of Record
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  You, the garden center, are the seller of record for all
                  transactions processed through the BloomSuite platform. You
                  are responsible for the sale of products, customer
                  relationships, product quality, and compliance with all
                  applicable laws and regulations governing your business
                  operations. BloomSuite is not the seller, reseller, or
                  distributor of any products offered through the platform.
                </p>
              </section>

              {/* 3. Payments and Fees */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  3. Payments and Fees
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Payment processing is handled through Stripe Connect. All
                  transactions are subject to Stripe's terms of service and
                  processing fees, which are paid by you, the garden center.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  BloomSuite charges a platform fee of 5% on the product
                  subtotal only. This fee is calculated before the application
                  of taxes and shipping charges. The platform fee covers access
                  to the BloomSuite software platform, third-party integrations,
                  fulfillment routing services, analytics and reporting tools,
                  and human technical support.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Platform fees are deducted automatically from your payouts
                  through Stripe Connect.
                </p>
              </section>

              {/* 4. Taxes */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  4. Taxes
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You are solely responsible for determining your tax
                  obligations, including sales tax nexus, tax collection, tax
                  filing, and tax remittance. BloomSuite provides automated tax
                  calculation services through third-party providers (such as
                  Avalara) as a convenience feature. These calculations are
                  provided on an as-is basis.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite does not provide tax advice. You should consult
                  with a qualified tax professional regarding your specific tax
                  obligations. BloomSuite is not liable for any errors or
                  omissions in tax calculations or for any taxes, penalties, or
                  interest that may be assessed against you.
                </p>
              </section>

              {/* 5. Fulfillment and Nursery Partners */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  5. Fulfillment and Nursery Partners
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  BloomSuite facilitates a ship-on-demand fulfillment model by
                  routing orders to approved nursery partners. These nurseries
                  act as fulfillment partners and are not parties to the sale
                  between you and your customers. Wholesale pricing arrangements
                  between you and nursery partners are handled separately from
                  the BloomSuite platform.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite does not guarantee inventory availability, product
                  quality, or shipping timelines. You are responsible for
                  managing customer expectations and addressing any fulfillment
                  issues that may arise.
                </p>
              </section>

              {/* 6. Customer Data and Marketing */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  6. Customer Data and Marketing
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Customer data collected through your website belongs to you.
                  BloomSuite may store, process, and use customer data solely to
                  operate the platform, provide services to you, and improve the
                  platform's functionality.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite will not sell customer data to third parties or use
                  customer data to compete with you or other garden centers on
                  the platform. You are responsible for complying with all
                  applicable privacy laws and regulations regarding the
                  collection and use of customer data.
                </p>
              </section>

              {/* 7. Support and Service Scope */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  7. Support and Service Scope
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  BloomSuite provides human technical support as part of the
                  platform subscription. Support includes assistance with
                  platform onboarding, feature usage, troubleshooting
                  platform-related issues, and general guidance on using
                  BloomSuite tools effectively.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Support does not include custom development, third-party
                  system configuration, marketing strategy consulting, or
                  services outside the scope of the BloomSuite platform.
                  Additional services may be available for an additional fee.
                </p>
              </section>

              {/* 8. Refunds, Chargebacks, and Disputes */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  8. Refunds, Chargebacks, and Disputes
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You are responsible for handling all customer refunds,
                  returns, chargebacks, and disputes. BloomSuite provides tools
                  to help you manage these situations, but assumes no liability
                  for the outcome of any refund, chargeback, or dispute.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Chargeback fees assessed by Stripe or payment networks are
                  your responsibility. Excessive chargebacks may result in
                  restrictions on your account or termination of services in
                  accordance with Stripe's acceptable use policies.
                </p>
              </section>

              {/* 9. Term and Termination */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  9. Term and Termination
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  This agreement begins when you accept it and continues until
                  terminated by either party. You may terminate your use of the
                  platform at any time by contacting BloomSuite support and
                  settling any outstanding balances.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite may suspend or terminate your access to the
                  platform immediately, without prior notice, for suspected
                  fraud, violation of these terms, misuse of the platform,
                  non-payment of fees, or any activity that threatens the
                  integrity or security of the platform or other users.
                </p>
              </section>

              {/* 10. Limitation of Liability */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  10. Limitation of Liability
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To the maximum extent permitted by law, BloomSuite and Brands
                  in Blooms Inc. shall not be liable for any indirect,
                  incidental, special, consequential, or punitive damages,
                  including but not limited to loss of profits, revenue, data,
                  or business opportunities, arising from your use of the
                  platform.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite's total liability for any claims arising under this
                  agreement shall be limited to the total fees paid by you to
                  BloomSuite during the twelve (12) months immediately preceding
                  the claim.
                </p>
              </section>

              {/* 11. Relationship of the Parties */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  11. Relationship of the Parties
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Nothing in this agreement creates a partnership, joint
                  venture, agency, franchise, or employment relationship between
                  you and BloomSuite. You are an independent business, and
                  BloomSuite is an independent technology provider. Neither
                  party has the authority to bind the other or make
                  representations on the other's behalf.
                </p>
              </section>

              {/* 12. Modifications */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  12. Modifications
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  BloomSuite may update or modify this agreement from time to
                  time. When material changes are made, we will notify you via
                  email or through the platform at least thirty (30) days before
                  the changes take effect. Your continued use of the platform
                  after the effective date of any modifications constitutes your
                  acceptance of the updated terms.
                </p>
              </section>

              {/* 13. Governing Law */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  13. Governing Law
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  This agreement is governed by the laws of the jurisdiction in
                  which Brands in Blooms Inc. is incorporated, without regard to
                  conflict of law principles. Any disputes arising from this
                  agreement shall be resolved in the courts of that
                  jurisdiction.
                </p>
              </section>

              {/* 14. Acceptance */}
              <section className="mb-4">
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  14. Acceptance
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  By checking the box below and clicking "Accept & Continue,"
                  you acknowledge that you have read, understood, and agree to
                  be bound by this BloomSuite Platform Agreement. This
                  electronic acceptance has the same legal effect as a
                  handwritten signature.
                </p>
              </section>
            </CardContent>
          </Card>

          {/* Acceptance UI */}
          <Card className="border-primary/20 bg-muted/30">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Checkbox */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="agreement-checkbox"
                    checked={agreed}
                    onCheckedChange={(checked) => setAgreed(checked === true)}
                    className="mt-1"
                    disabled={isSubmitting}
                  />
                  <Label
                    htmlFor="agreement-checkbox"
                    className="text-foreground font-medium cursor-pointer leading-relaxed"
                  >
                    I have read and agree to the BloomSuite Platform Agreement.
                  </Label>
                </div>

                {/* Helper text */}
                {!agreed && (
                  <p className="text-sm text-muted-foreground">
                    You must accept the agreement to continue.
                  </p>
                )}

                {/* Accept Button */}
                <Button
                  onClick={handleAccept}
                  disabled={!agreed || isSubmitting}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Accept & Continue"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default PlatformAgreementPage;
