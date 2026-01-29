import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEvent } from "@/types/activity";
import { ActivityDescription } from "./ActivityDescription";

function formatActivityType(value?: string) {
  if (!value) return "";
  const normalized = value.replace(/_/g, " ");
  const parts = normalized.split(".").filter(Boolean);
  const joined = parts.join(" ");
  if (!joined) return "";
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

export function ActivityRow({
  event,
  className,
  customerNameOverride,
}: {
  event: ActivityEvent;
  className?: string;
  customerNameOverride?: string;
}) {
  const isCustomerCreated =
    String(event.activity_type) === "customer.created" ||
    String(event.title).toLowerCase().includes("customer created");

  const customerHref = event.customer_id
    ? `/crm/customers/${event.customer_id}`
    : null;

  const customerName = useMemo(() => {
    if (
      typeof customerNameOverride === "string" &&
      customerNameOverride.trim()
    ) {
      return customerNameOverride.trim();
    }

    const metadata = (event.metadata as any) ?? {};
    const metaName =
      metadata.customer_name ||
      `${metadata.customer_first_name ?? ""} ${metadata.customer_last_name ?? ""}`.trim();

    if (metaName) return metaName;

    const related = (event.related_entities as any) ?? {};
    const relatedName =
      related.customer_name ||
      `${related.customer_first_name ?? ""} ${related.customer_last_name ?? ""}`.trim() ||
      related.customer?.name ||
      related.customer?.full_name ||
      `${related.customer?.first_name ?? ""} ${related.customer?.last_name ?? ""}`.trim() ||
      `${related.customer?.firstName ?? ""} ${related.customer?.lastName ?? ""}`.trim();

    if (typeof relatedName === "string" && relatedName.trim())
      return relatedName.trim();

    if (isCustomerCreated) {
      const parts = (event.description as any)?.parts || [];
      const textPart = parts.find((p: any) => p?.type === "text" && p?.text);
      if (typeof textPart?.text === "string") return textPart.text;
    }

    return "";
  }, [
    customerNameOverride,
    event.description,
    event.metadata,
    event.related_entities,
    isCustomerCreated,
  ]);

  const shouldShowCustomer =
    Boolean(event.customer_id) && !isCustomerCreated && Boolean(customerName);

  const detailHref = `/activity/${encodeURIComponent(String(event.id))}`;

  const links = Array.isArray(event.links) ? event.links : [];

  return (
    <div className={cn("py-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isCustomerCreated ? null : (
                <div className="font-medium truncate">{event.title}</div>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {event.activity_type && !isCustomerCreated ? (
                <span className="truncate">
                  • {formatActivityType(String(event.activity_type))}
                </span>
              ) : null}
            </div>

            <div className="text-sm">
              {isCustomerCreated ? (
                <span>
                  {customerName ? (
                    <>
                      Customer{" "}
                      {customerHref ? (
                        <a
                          href={customerHref}
                          className="text-brand-teal hover:underline"
                        >
                          {customerName}
                        </a>
                      ) : (
                        <span className="font-medium">{customerName}</span>
                      )}{" "}
                      has been created.
                    </>
                  ) : (
                    <>Customer has been created.</>
                  )}
                </span>
              ) : (
                <div className="flex flex-wrap items-baseline gap-1">
                  {shouldShowCustomer ? (
                    <span className="text-muted-foreground">
                      Customer{" "}
                      {customerHref ? (
                        <a
                          href={customerHref}
                          className="text-brand-teal hover:underline"
                        >
                          {customerName}
                        </a>
                      ) : (
                        <span className="font-medium">{customerName}</span>
                      )}{" "}
                      —
                    </span>
                  ) : null}
                  <ActivityDescription description={event.description} />
                </div>
              )}
            </div>

            {event.error_message ? (
              <div className="mt-2 text-sm text-red-600">
                {event.error_message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={detailHref}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Details</span>
          </a>
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
        </div>
      </div>
    </div>
  );
}
