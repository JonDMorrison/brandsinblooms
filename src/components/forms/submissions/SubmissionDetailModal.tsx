import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Bot,
  Mail,
  MessageSquare,
  Globe,
  Link2,
  User,
  MapPin,
  Calendar,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  TestTube2,
} from "lucide-react";
import { format } from "date-fns";
import {
  Form,
  FormSubmission,
  FormSubmissionMetadata,
  SubmissionResult,
} from "@/types/formBuilder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatFileSize,
  getFormFileUploadReferences,
} from "@/lib/forms/fileUploads";
import {
  formatSubmissionValue,
  getSubmissionDiagnosticEntries,
  getSubmissionDisplayEmail,
  getSubmissionDisplayName,
  getSubmissionDisplaySource,
  getSubmissionVisibleEntries,
  isTestSubmission,
} from "@/lib/forms/submissionPresentation";

interface SubmissionDetailModalProps {
  form: Pick<Form, "fields_json"> | null;
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const resultConfig: Record<
  SubmissionResult,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ReactNode;
    className?: string;
  }
> = {
  accepted: {
    label: "Accepted",
    variant: "default",
    icon: <CheckCircle className="h-4 w-4" />,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  rejected_invalid: {
    label: "Invalid",
    variant: "destructive",
    icon: <AlertCircle className="h-4 w-4" />,
  },
  rejected_rate_limited: {
    label: "Rate Limited",
    variant: "outline",
    icon: <Clock className="h-4 w-4" />,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  rejected_spam: {
    label: "Spam",
    variant: "outline",
    icon: <Bot className="h-4 w-4" />,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

function getSubmissionResultInfo(submission: FormSubmission) {
  switch (submission.result) {
    case "accepted":
      return resultConfig.accepted;
    case "rejected_invalid":
      return resultConfig.rejected_invalid;
    case "rejected_rate_limited":
      return resultConfig.rejected_rate_limited;
    case "rejected_spam":
      return resultConfig.rejected_spam;
    default: {
      switch (submission.metadata?.rejection_type) {
        case "rate_limited":
          return resultConfig.rejected_rate_limited;
        case "spam":
          return resultConfig.rejected_spam;
        default:
          return resultConfig.rejected_invalid;
      }
    }
  }
}

export function SubmissionDetailModal({
  form,
  submission,
  open,
  onOpenChange,
}: SubmissionDetailModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const visibleEntries = useMemo(
    () =>
      form && submission ? getSubmissionVisibleEntries(form, submission) : [],
    [form, submission],
  );
  const diagnosticEntries = useMemo(
    () =>
      form && submission
        ? getSubmissionDiagnosticEntries(form, submission)
        : [],
    [form, submission],
  );
  const fileEntries = useMemo(
    () => visibleEntries.filter((entry) => entry.kind === "file"),
    [visibleEntries],
  );
  const [signedUrls, setSignedUrls] = useState<
    Record<string, { url?: string; error?: string }>
  >({});

  useEffect(() => {
    if (!open || !submission || fileEntries.length === 0) {
      setSignedUrls({});
      return;
    }

    let canceled = false;
    const references = Array.from(
      new Map(
        fileEntries
          .flatMap((entry) => getFormFileUploadReferences(entry.rawValue))
          .map((reference) => [reference.path, reference]),
      ).values(),
    );

    setSignedUrls(
      Object.fromEntries(references.map((reference) => [reference.path, {}])),
    );

    void (async () => {
      const nextEntries = await Promise.all(
        references.map(async (reference) => {
          const { data, error } = await supabase.storage
            .from(reference.bucket)
            .createSignedUrl(reference.path, 60 * 30);

          return [
            reference.path,
            error
              ? { error: error.message }
              : { url: data?.signedUrl || undefined },
          ] as const;
        }),
      );

      if (!canceled) {
        setSignedUrls(Object.fromEntries(nextEntries));
      }
    })();

    return () => {
      canceled = true;
    };
  }, [fileEntries, open, submission]);

  if (!submission) return null;

  const resultInfo = getSubmissionResultInfo(submission);
  const metadata =
    submission.metadata || ({} as Partial<FormSubmissionMetadata>);
  const name = getSubmissionDisplayName(submission);
  const email = getSubmissionDisplayEmail(submission);
  const source = getSubmissionDisplaySource(submission);
  const isTest = isTestSubmission(submission);

  const handleCopy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast({
      title: `${label} copied`,
      description: `${label} was copied to your clipboard.`,
    });
  };

  const handleCopyJson = async () => {
    await handleCopy("Submission JSON", JSON.stringify(submission, null, 2));
  };

  const handleViewCustomer = () => {
    if (!submission.customer_id) {
      return;
    }

    onOpenChange(false);
    navigate(`/crm/customers/${submission.customer_id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span>Submission Details</span>
                <Badge
                  variant={resultInfo.variant}
                  className={`flex items-center gap-1 ${resultInfo.className || ""}`}
                >
                  {resultInfo.icon}
                  {resultInfo.label}
                </Badge>
                {isTest && (
                  <Badge variant="outline" className="gap-1">
                    <TestTube2 className="h-3.5 w-3.5" />
                    Test
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Submitted {format(new Date(submission.submitted_at), "PPpp")}
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {submission.customer_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewCustomer}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Customer
                </Button>
              )}
              {email !== "—" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy("Email", email)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Email
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopyJson()}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy JSON
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-120px)]">
          <div className="p-6 pt-4 space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Name" value={name || "—"} />
              <SummaryCard label="Email" value={email} mono />
              <SummaryCard label="Source" value={source} />
            </div>

            {/* Rejection Reason */}
            {submission.reason && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive">
                  Rejection Reason
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {submission.reason}
                </p>
              </div>
            )}

            {/* Submitted Data */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Submitted Data
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {visibleEntries.length > 0 ? (
                  visibleEntries.map((entry) =>
                    entry.kind === "file" ? (
                      <SubmissionFileEntry
                        key={entry.id}
                        label={entry.label}
                        references={getFormFileUploadReferences(entry.rawValue)}
                        signedUrls={signedUrls}
                      />
                    ) : (
                      <div
                        key={entry.id}
                        className="flex justify-between items-start gap-4"
                      >
                        <span className="text-sm text-muted-foreground">
                          {entry.label}
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%] break-words">
                          {entry.displayValue}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No visible submitted fields were captured for this entry.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Consent Information */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Consent Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <ConsentCard
                  type="email"
                  consented={metadata.email_consent === true}
                  text={metadata.email_consent_text}
                  timestamp={metadata.email_consent_at}
                />
                <ConsentCard
                  type="sms"
                  consented={metadata.sms_consent === true}
                  text={metadata.sms_consent_text}
                  timestamp={metadata.sms_consent_at}
                />
              </div>
            </div>

            <Separator />

            {/* Source & Attribution */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Source & Attribution
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                {metadata.page_url && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> Page URL
                    </span>
                    <span className="text-sm font-mono text-right max-w-[60%] break-all">
                      {metadata.page_url}
                    </span>
                  </div>
                )}
                {metadata.referrer && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-muted-foreground">
                      Referrer
                    </span>
                    <span className="text-sm font-mono text-right max-w-[60%] break-all">
                      {metadata.referrer}
                    </span>
                  </div>
                )}
                {(metadata.utm_source ||
                  metadata.utm_medium ||
                  metadata.utm_campaign) && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex flex-wrap gap-2">
                      {metadata.utm_source && (
                        <Badge variant="outline" className="text-xs">
                          utm_source: {metadata.utm_source}
                        </Badge>
                      )}
                      {metadata.utm_medium && (
                        <Badge variant="outline" className="text-xs">
                          utm_medium: {metadata.utm_medium}
                        </Badge>
                      )}
                      {metadata.utm_campaign && (
                        <Badge variant="outline" className="text-xs">
                          utm_campaign: {metadata.utm_campaign}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {diagnosticEntries.length > 0 && (
              <>
                <Separator />

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <TestTube2 className="h-4 w-4" />
                      Hidden & System Values
                    </h3>
                    <Badge variant="outline">{diagnosticEntries.length}</Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    {diagnosticEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex justify-between items-start gap-4"
                      >
                        <span className="text-sm text-muted-foreground">
                          {entry.label}
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%] break-words">
                          {entry.displayValue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Technical Details */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Technical Details
              </h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submission ID</span>
                  <span>{submission.id}</span>
                </div>
                {submission.customer_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer ID</span>
                    <span>{submission.customer_id}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Detected source</span>
                  <span>{source}</span>
                </div>
                {submission.ip_hash && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP Hash</span>
                    <span>{submission.ip_hash.slice(0, 16)}...</span>
                  </div>
                )}
                {metadata.user_agent && (
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">User Agent</span>
                    <span className="text-right max-w-[60%] break-words">
                      {metadata.user_agent.slice(0, 80)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionFileEntry({
  label,
  references,
  signedUrls,
}: {
  label: string;
  references: ReturnType<typeof getFormFileUploadReferences>;
  signedUrls: Record<string, { url?: string; error?: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Badge variant="outline">
          {references.length} file{references.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="space-y-3">
        {references.map((reference) => {
          const fileState = signedUrls[reference.path];
          const isImage = reference.mime_type.startsWith("image/");

          return (
            <div
              key={reference.path}
              className="rounded-lg border bg-background p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted/50 overflow-hidden shrink-0">
                  {isImage && fileState?.url ? (
                    <img
                      src={fileState.url}
                      alt={reference.file_name}
                      className="h-full w-full object-cover"
                    />
                  ) : isImage ? (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium break-words">
                    {reference.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(reference.file_size)}
                    {reference.mime_type ? ` • ${reference.mime_type}` : ""}
                  </p>
                  {fileState?.error ? (
                    <p className="text-xs text-destructive">
                      {fileState.error}
                    </p>
                  ) : null}
                </div>

                {fileState?.url ? (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={fileState.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                ) : (
                  <div className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Preparing
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium text-foreground break-words ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

interface ConsentCardProps {
  type: "email" | "sms";
  consented: boolean;
  text?: string;
  timestamp?: string;
}

function ConsentCard({ type, consented, text, timestamp }: ConsentCardProps) {
  const Icon = type === "email" ? Mail : MessageSquare;
  const label = type === "email" ? "Email Marketing" : "SMS Messages";

  return (
    <div
      className={`p-3 rounded-lg border ${consented ? "bg-green-50 border-green-200" : "bg-muted/30 border-muted"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`h-4 w-4 ${consented ? "text-green-600" : "text-muted-foreground"}`}
        />
        <span className="text-sm font-medium">{label}</span>
        {consented ? (
          <Badge
            variant="outline"
            className="ml-auto text-xs bg-green-100 text-green-800 border-green-200"
          >
            Consented
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto text-xs">
            Not given
          </Badge>
        )}
      </div>
      {consented && text && (
        <p className="text-xs text-muted-foreground italic mb-1">
          "{formatSubmissionValue(text)}"
        </p>
      )}
      {consented && timestamp && (
        <p className="text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          {format(new Date(timestamp), "PPpp")}
        </p>
      )}
    </div>
  );
}
