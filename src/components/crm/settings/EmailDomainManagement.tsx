import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { useEmailDomainManagement } from "@/hooks/useEmailDomainManagement";
import {
  getDomainStatusConfig,
  formatReputationRate,
  isReputationHealthy,
} from "@/lib/email/domainService";
import { DomainConnectWizard } from "./DomainConnectWizard";
import { DomainSenderSettings } from "./DomainSenderSettings";
import { DnsInstructionsCard } from "./DnsInstructionsCard";
import { EmailDomainGuide } from "./EmailDomainGuide";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const EmailDomainManagement: React.FC = () => {
  const {
    domains,
    loading,
    refreshVerificationStatus,
    deleteDomain,
    refetch,
  } = useEmailDomainManagement();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [showDnsInstructions, setShowDnsInstructions] = useState<string | null>(
    null,
  );
  const [showSenderSettings, setShowSenderSettings] = useState<string | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  const handleOpenGuide = () => {
    setGuideOpen(true);
    // Scroll to guide section after state update
    setTimeout(() => {
      guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleRefreshVerification = async (domainId: string) => {
    setRefreshing(domainId);
    await refreshVerificationStatus(domainId);
    setRefreshing(null);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteDomain(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  // Auto-open guide when no domains exist
  const shouldShowGuide = guideOpen || domains.length === 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Email Sending Domains</CardTitle>
                <CardDescription>
                  Manage your custom sending domains for better deliverability
                  and brand recognition.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGuideOpen(!guideOpen)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                {guideOpen ? "Hide Guide" : "Setup Guide"}
              </Button>
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Domain
              </Button>
            </div>
          </div>

          {/* Quick help link */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-sm">
            <span className="text-muted-foreground">Quick links:</span>
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Resend Domain Settings <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={handleOpenGuide}
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              DNS Setup Instructions <BookOpen className="h-3 w-3" />
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* Setup Guide - Collapsible */}
      <div ref={guideRef}>
        <Collapsible open={shouldShowGuide} onOpenChange={setGuideOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base">
                        Email Domain Setup Guide
                      </CardTitle>
                      <CardDescription>
                        Learn why custom domains matter and how to set yours up
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${shouldShowGuide ? "rotate-180" : ""}`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <EmailDomainGuide />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Domain List */}
      {domains.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Domains Connected</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Connect your first custom domain to start sending emails from your
              own address. You'll need to add DNS records (SPF, DKIM, DMARC) to
              verify ownership.
            </p>
            <div className="flex flex-col items-center gap-3">
              <Button onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Domain
              </Button>
              <button
                onClick={handleOpenGuide}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <BookOpen className="h-4 w-4" />
                Read setup instructions first
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => {
            const statusConfig = getDomainStatusConfig(domain.status);
            const reputation = isReputationHealthy(domain);

            return (
              <Card key={domain.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Domain Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold">
                          {domain.domain}
                        </h3>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </div>

                      {/* Pending DNS progress guidance */}
                      {domain.status === "pending_dns" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            <span className="text-green-700 font-medium">Domain registered</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">Add DNS records</span>
                            <span>→</span>
                            <span>Verified & ready</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Click <span className="font-medium text-foreground">DNS Instructions</span> to see the exact records to add to your domain provider. After adding them, click <span className="font-medium text-foreground">Check DNS</span>.
                          </p>
                        </div>
                      )}

                      {/* Verifying status guidance */}
                      {domain.status === "verifying" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            <span className="text-green-700 font-medium">DNS records added</span>
                            <span>→</span>
                            <span className="font-medium text-foreground">Waiting for propagation</span>
                            <span>→</span>
                            <span>Verified & ready</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            DNS changes typically propagate within 5–30 minutes, but can take up to 48 hours. Click <span className="font-medium text-foreground">Check DNS</span> to test again.
                          </p>
                        </div>
                      )}

                      {/* Sender Info */}
                      {domain.default_from_email && (
                        <p className="text-sm text-muted-foreground">
                          Default sender:{" "}
                          <span className="font-medium">
                            {domain.default_from_name || "Unknown"}
                          </span>{" "}
                          ({domain.default_from_email})
                        </p>
                      )}

                      {/* Reputation Stats */}
                      {(domain.status === "warming_up" ||
                        domain.status === "active") && (
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            {reputation.bounceWarning ? (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-sm">
                              Bounce rate:{" "}
                              <span
                                className={
                                  reputation.bounceWarning
                                    ? "text-orange-600 font-medium"
                                    : ""
                                }
                              >
                                {formatReputationRate(domain.bounce_rate_30d)}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {reputation.complaintWarning ? (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-sm">
                              Complaint rate:{" "}
                              <span
                                className={
                                  reputation.complaintWarning
                                    ? "text-orange-600 font-medium"
                                    : ""
                                }
                              >
                                {formatReputationRate(
                                  domain.complaint_rate_30d,
                                )}
                              </span>
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            Sent (30d): {domain.total_sent_30d}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {(domain.status === "pending_dns" ||
                        domain.status === "verifying") && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDnsInstructions(domain.id)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            DNS Instructions
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRefreshVerification(domain.id)}
                            disabled={refreshing === domain.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-1 ${refreshing === domain.id ? "animate-spin" : ""}`}
                            />
                            Check DNS
                          </Button>
                        </>
                      )}

                      {(domain.status === "warming_up" ||
                        domain.status === "active") && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSenderSettings(domain.id)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Sender Settings
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(domain.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Notes/Errors */}
                  {(domain.notes || domain.status === "failed") && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <p className="text-muted-foreground">
                            {domain.notes ||
                              "Domain verification failed. Please check your DNS settings."}
                          </p>
                        </div>
                        {domain.status === "failed" && (
                          <p className="text-xs text-muted-foreground ml-6">
                            Common causes: incorrect record values, missing records, or a conflicting existing record. Click <span className="font-medium text-foreground">DNS Instructions</span> to review the expected records, then click <span className="font-medium text-foreground">Connect Domain</span> to try again.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Wizard Dialog */}
      <DomainConnectWizard
        open={showWizard}
        onClose={() => {
          setShowWizard(false);
          refetch();
        }}
      />

      {/* DNS Instructions Dialog */}
      {showDnsInstructions && (
        <DnsInstructionsCard
          domainId={showDnsInstructions}
          open={!!showDnsInstructions}
          onClose={() => setShowDnsInstructions(null)}
        />
      )}

      {/* Sender Settings Dialog */}
      {showSenderSettings && (
        <DomainSenderSettings
          domainId={showSenderSettings}
          open={!!showSenderSettings}
          onClose={() => setShowSenderSettings(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the domain from your account. You will need to
              reconfigure DNS records if you add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
