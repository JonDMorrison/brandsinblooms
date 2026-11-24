import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui-legacy/radio-group";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { Label } from "@/components/ui-legacy/label";
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import {
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  PartyPopper,
  HeartHandshake,
  Sprout,
  Gift,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_INTEREST_OPTIONS,
  GARDENING_EXPERIENCE_OPTIONS,
  normalizeCustomerPreferenceSnapshot,
  type CustomerInterestId,
  type GardeningExperience,
} from "@/lib/crm/customerPreferenceCenter";

import {NativeRewardBalanceList} from "@/components/crm/customer-dashboard/NativeRewardBalanceList";
import type {NativeRewardBalance} from "../../supabase/functions/_shared/nativeRewardBalances";

type PageState =
  | "loading"
  | "invalid"
  | "expired"
  | "form"
  | "success_opted_in"
  | "success_opted_out"
  | "error";

interface TokenData {
  tenant_id: string;
  customer_id: string;
  email: string;
  purpose: string;
  preferences?: unknown;
  loyalty?: LoyaltyWalletEntry[];
  nativeLoyalty?: NativeRewardBalance[];
  nativeLoyaltyError?: string | null;
}

interface LoyaltyWalletEntry {
  provider: string;
  programName: string;
  balance: number;
  balanceUnit: "points" | "currency" | "unknown";
  currency: string | null;
  lastSyncedAt: string;
}

interface CompanyInfo {
  name: string;
  address?: string;
}

function formatLoyaltyBalance(entry: LoyaltyWalletEntry) {
  if (entry.balanceUnit === "currency" && entry.currency) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: entry.currency,
    }).format(entry.balance);
  }

  if (entry.balanceUnit === "points") {
    return `${entry.balance.toLocaleString()} ${entry.balance === 1 ? "point" : "points"}`;
  }

  return `${entry.balance.toLocaleString()} available`;
}

type RefreshState = "idle" | "working" | "not_found" | "error";

export default function EmailPreferences() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");

  // Preference tokens are reusable, so a link that does not open is invalid
  // or expired. Whoever holds it received an email from the store, so the
  // page can swap it for a current link (refresh-preference-link).
  const requestFreshLink = async () => {
    if (!token) return;
    setRefreshState("working");
    try {
      const { data, error } = await supabase.functions.invoke(
        "refresh-preference-link",
        { body: { token } },
      );
      if (error) {
        setRefreshState("error");
        return;
      }
      if (data?.refreshed && typeof data.token === "string") {
        setRefreshState("idle");
        setState("loading");
        setSearchParams({ token: data.token }, { replace: true });
        return;
      }
      setRefreshState("not_found");
    } catch (err) {
      console.error("Preference link refresh error:", err);
      setRefreshState("error");
    }
  };

  const [state, setState] = useState<PageState>("loading");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [preference, setPreference] = useState<
    "subscribe" | "unsubscribe" | null
  >(null);
  const [interests, setInterests] = useState<CustomerInterestId[]>([]);
  const [gardeningExperience, setGardeningExperience] =
    useState<GardeningExperience | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    const validateToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "validate-preference-token",
          {
            body: { token },
          },
        );

        if (error || !data?.valid) {
          setState(data?.error === "Token expired" ? "expired" : "invalid");
          return;
        }

        const initialPreferences = normalizeCustomerPreferenceSnapshot(
          data.data?.preferences,
        );
        setTokenData(data.data);
        setCompanyInfo(data.company || { name: "Our Company" });
        setPreference(
          initialPreferences.emailOptIn === true
            ? "subscribe"
            : initialPreferences.emailOptIn === false
              ? "unsubscribe"
              : null,
        );
        setInterests(initialPreferences.interests);
        setGardeningExperience(initialPreferences.gardeningExperience);
        setState("form");
      } catch (err) {
        console.error("Token validation error:", err);
        setState("error");
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !tokenData || preference === null) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "update-email-preference",
        {
          body: {
            token,
            emailOptIn: preference === "subscribe",
            interests,
            gardeningExperience,
          },
        },
      );

      if (error || !data?.success) {
        setState("error");
        return;
      }

      setState(
        preference === "subscribe" ? "success_opted_in" : "success_opted_out",
      );
    } catch (err) {
      console.error("Preference update error:", err);
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInterest = (interest: CustomerInterestId, checked: boolean) => {
    setInterests((current) =>
      checked
        ? Array.from(new Set([...current, interest]))
        : current.filter((value) => value !== interest),
    );
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your preferences...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired link (tokens are reusable, never "used up").
  if (state === "invalid" || state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <CardTitle>Link not working</CardTitle>
            <CardDescription>
              This link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {token && refreshState !== "not_found" ? (
              <Button
                className="w-full"
                onClick={() => void requestFreshLink()}
                disabled={refreshState === "working"}
                data-testid="request-fresh-preference-link"
              >
                {refreshState === "working" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting a new link...
                  </>
                ) : (
                  "Get a new link"
                )}
              </Button>
            ) : null}
            {refreshState === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>
                  We could not get a new link right now. Please try again.
                </AlertDescription>
              </Alert>
            ) : null}
            <Alert>
              <AlertDescription>
                {refreshState === "not_found" || !token
                  ? "We couldn't find this link. Open \"Manage preferences\" in the most recent email you received; every email includes a current link."
                  : "Every email you receive also includes a current \"Manage preferences\" link."}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Something Went Wrong</CardTitle>
            <CardDescription>
              We couldn't update your preferences. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Success - Opted In
  if (state === "success_opted_in") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <PartyPopper className="h-6 w-6 text-blue-800" />
            </div>
            <CardTitle className="text-blue-900">You're Subscribed!</CardTitle>
            <CardDescription>
              You're now subscribed to email updates from {companyInfo?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>You can unsubscribe at any time using the link in our emails.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success - Opted Out
  if (state === "success_opted_out") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <HeartHandshake className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Preferences Updated</CardTitle>
            <CardDescription>
              We've updated your preferences. You won't receive marketing emails
              from {companyInfo?.name} going forward.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              If you change your mind, you can always re-subscribe through our
              website.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>What would you like to grow?</CardTitle>
          <CardDescription>
            Choose the updates that are useful to you. You can change these
            preferences any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3" aria-labelledby="interest-heading">
            <div>
              <h2 id="interest-heading" className="font-medium">
                Your gardening interests
              </h2>
              <p className="text-sm text-muted-foreground">
                Select as many as you like for {tokenData?.email}.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CUSTOMER_INTEREST_OPTIONS.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`interest-${option.id}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal hover:bg-muted/50"
                >
                  <Checkbox
                    id={`interest-${option.id}`}
                    checked={interests.includes(option.id)}
                    onCheckedChange={(checked) =>
                      toggleInterest(option.id, checked === true)
                    }
                  />
                  <span>{option.label}</span>
                </Label>
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="experience-heading">
            <div>
              <h2 id="experience-heading" className="font-medium">
                Your gardening experience
              </h2>
              <p className="text-sm text-muted-foreground">
                This helps {companyInfo?.name} make advice more useful.
              </p>
            </div>
            <RadioGroup
              value={gardeningExperience ?? ""}
              onValueChange={(value) =>
                setGardeningExperience(value as GardeningExperience)
              }
              className="grid gap-2 sm:grid-cols-3"
            >
              {GARDENING_EXPERIENCE_OPTIONS.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`experience-${option.id}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal hover:bg-muted/50"
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`experience-${option.id}`}
                  />
                  <span>{option.label}</span>
                </Label>
              ))}
            </RadioGroup>
          </section>

          <NativeRewardBalanceList balances={tokenData?.nativeLoyalty ?? []} error={tokenData?.nativeLoyaltyError} />
          {tokenData?.loyalty?.length ? (
            <section
              className="space-y-3 border-t pt-6"
              aria-labelledby="rewards-heading"
            >
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                <h2 id="rewards-heading" className="font-medium">
                  Your rewards
                </h2>
              </div>
              <div className="space-y-2">
                {tokenData.loyalty.map((entry) => (
                  <div
                    key={`${entry.provider}-${entry.programName}`}
                    className="flex items-center justify-between gap-4 rounded-lg border bg-primary/5 p-4"
                  >
                    <div>
                      <p className="font-medium">{entry.programName}</p>
                      <p className="text-xs text-muted-foreground">
                        {["legacy_metrics", "crm_import"].includes(entry.provider) ? "Imported historical balance" : `Reported by ${entry.provider}`}
                        {entry.lastSyncedAt ? ` · ${new Date(entry.lastSyncedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-primary">
                      {formatLoyaltyBalance(entry)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section
            className="space-y-3 border-t pt-6"
            aria-labelledby="email-heading"
          >
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-primary" />
              <h2 id="email-heading" className="font-medium">
                Email updates
              </h2>
            </div>
            <RadioGroup
              value={preference ?? ""}
              onValueChange={(v) =>
                setPreference(v as "subscribe" | "unsubscribe")
              }
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem
                  value="subscribe"
                  id="subscribe"
                  className="mt-1"
                />
                <Label htmlFor="subscribe" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-4 w-4 text-blue-700" />
                    Yes, I want to receive updates
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get seasonal tips, promotions, and event updates from{" "}
                    {companyInfo?.name}
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem
                  value="unsubscribe"
                  id="unsubscribe"
                  className="mt-1"
                />
                <Label htmlFor="unsubscribe" className="cursor-pointer flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    <XCircle className="h-4 w-4 text-red-500" />
                    No, I don't want marketing emails
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    You won't receive promotional emails, but may still get
                    transactional messages
                  </p>
                </Label>
              </div>
            </RadioGroup>
            {preference === null ? (
              <p className="text-sm text-muted-foreground" role="status">
                Choose whether you want marketing emails before saving.
              </p>
            ) : null}
          </section>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={submitting || preference === null}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {companyInfo?.name}
            {companyInfo?.address && (
              <>
                <br />
                {companyInfo.address}
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
