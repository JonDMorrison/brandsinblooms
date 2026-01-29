import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Info,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityDescription } from "@/components/activity/ActivityDescription";
import { ActivityKeyValueList } from "@/components/activity/ActivityKeyValueList";
import { useActivityEvent } from "@/hooks/useActivityEvent";

function statusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-600" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    case "pending":
      return <Clock className="h-5 w-5 text-muted-foreground" />;
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
}

function statusVariant(status: string): any {
  switch (status) {
    case "success":
      return "secondary";
    case "failed":
      return "destructive";
    case "warning":
      return "outline";
    case "pending":
      return "outline";
    default:
      return "outline";
  }
}

const LABEL_MAP: Record<string, string> = {
  customer_id: "Customer",
  automation_id: "Automation",
  automation_run_id: "Automation Run",
  run_sequence: "Run Sequence",
  trigger_type: "Trigger",
  step_index: "Step",
  segment_id: "Segment",
  segment_name: "Segment",
  persona_id: "Persona",
  email: "Email",
  phone: "Phone",
};

export default function ActivityDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading, isError } = useActivityEvent(eventId);

  const ts = useMemo(() => (event ? new Date(event.timestamp) : null), [event]);
  const relative = useMemo(() => {
    if (!ts) return "";
    try {
      return formatDistanceToNowStrict(ts, { addSuffix: true });
    } catch {
      return "";
    }
  }, [ts]);

  const customerHref = event?.customer_id
    ? `/crm/customers/${event.customer_id}`
    : null;

  const automationContext = useMemo(() => {
    if (!event) return null;
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    const related = (event.related_entities ?? {}) as Record<string, unknown>;
    const context = {
      automation_id: metadata.automation_id ?? related.automation_id,
      automation_run_id:
        metadata.automation_run_id ?? related.automation_run_id,
      run_sequence: metadata.run_sequence,
      trigger_type: metadata.trigger_type,
      step_index: metadata.step_index,
    } as Record<string, unknown>;

    const hasAutomation =
      String(event.activity_type || "").includes("automation") ||
      Object.values(context).some(
        (value) => value !== undefined && value !== null,
      );

    return hasAutomation ? context : null;
  }, [event]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-sm text-muted-foreground">
          Loading activity details…
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Activity details not found.
        </div>
      </div>
    );
  }

  const links = Array.isArray(event.links) ? event.links : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="text-sm text-muted-foreground">Activity details</div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1">{statusIcon(String(event.status))}</div>
              <div>
                <CardTitle className="text-xl">{event.title}</CardTitle>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(String(event.status))}>
                    {String(event.status)}
                  </Badge>
                  <Badge variant="outline">{String(event.actor_type)}</Badge>
                  <Badge variant="outline">{String(event.source)}</Badge>
                  {event.integration_name ? (
                    <Badge variant="outline">{event.integration_name}</Badge>
                  ) : null}
                </div>
              </div>
            </div>
            {customerHref ? (
              <a
                href={customerHref}
                className="text-sm text-brand-teal hover:underline"
              >
                View customer
              </a>
            ) : null}
          </div>

          <div className="text-sm text-muted-foreground">
            {relative || (ts ? format(ts, "PPpp") : "")}
            {event.activity_type ? <span> • {event.activity_type}</span> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium">What happened</div>
            <div className="mt-2">
              <ActivityDescription description={event.description} />
            </div>
          </div>

          {event.error_message ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {event.error_message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {automationContext ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automation context</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityKeyValueList
              data={automationContext}
              labelMap={LABEL_MAP}
              emptyLabel="No automation details"
            />
            {automationContext.automation_id ? (
              <div className="mt-3">
                <a
                  href={`/crm/automations/${automationContext.automation_id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open automation
                </a>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityKeyValueList
              data={(event.metadata ?? {}) as Record<string, unknown>}
              labelMap={LABEL_MAP}
              emptyLabel="No metadata"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityKeyValueList
              data={(event.related_entities ?? {}) as Record<string, unknown>}
              hiddenKeys={["customer_id"]}
              labelMap={LABEL_MAP}
              emptyLabel="No related items"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links & references</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {links.length ? (
            links
              .filter((l) => l && typeof l === "object" && l.href)
              .map((l, idx) => (
                <a
                  key={idx}
                  href={String(l.href)}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  {String(l.label || l.type || "Open link")}
                </a>
              ))
          ) : (
            <div className="text-sm text-muted-foreground">
              No links available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
