import React, { useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types/activity";
import { ActivityDescription } from "./ActivityDescription";

function statusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
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

export function ActivityRow({
  event,
  className,
}: {
  event: ActivityEvent;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const ts = useMemo(() => new Date(event.timestamp), [event.timestamp]);
  const relative = useMemo(() => {
    try {
      return formatDistanceToNowStrict(ts, { addSuffix: true });
    } catch {
      return "";
    }
  }, [ts]);

  const customerHref = event.customer_id
    ? `/crm/customers/${event.customer_id}`
    : null;

  const links = Array.isArray(event.links) ? event.links : [];

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">{statusIcon(String(event.status))}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-medium truncate">{event.title}</div>
              <Badge variant={statusVariant(String(event.status))}>
                {String(event.status)}
              </Badge>
              <Badge variant="outline">{String(event.actor_type)}</Badge>
              <Badge variant="outline">{String(event.source)}</Badge>
              {event.integration_name ? (
                <Badge variant="outline">{event.integration_name}</Badge>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span title={format(ts, "PPpp")}>
                {relative || format(ts, "PPpp")}
              </span>
              {event.activity_type ? (
                <span className="truncate">• {event.activity_type}</span>
              ) : null}
              {customerHref ? (
                <a
                  href={customerHref}
                  className="text-brand-teal hover:underline"
                >
                  • View customer
                </a>
              ) : null}
            </div>

            <div className="mt-2">
              <ActivityDescription description={event.description} />
            </div>

            {event.error_message ? (
              <div className="mt-2 text-sm text-red-600">
                {event.error_message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {links
            .filter((l) => l && typeof l === "object" && l.href)
            .slice(0, 2)
            .map((l, idx) => (
              <a
                key={idx}
                href={String(l.href)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="hidden sm:inline">Link</span>
              </a>
            ))}

          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {open ? "Hide" : "Details"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground mb-1">Metadata</div>
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(event.metadata ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Related</div>
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(event.related_entities ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
