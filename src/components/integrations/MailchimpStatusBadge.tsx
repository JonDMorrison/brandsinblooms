/** @deprecated — No longer route-connected. Superseded by the IntegrationDetailPage and detailPrimitives-based surfaces (INT-UI-006). */
import React from "react";
import { Badge } from "@/components/ui-legacy/badge";
import { Button } from "@/components/ui-legacy/button";
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMailchimpConnectionSummary } from "@/hooks/useMailchimpConnectionSummary";

interface MailchimpStatusBadgeProps {
  onRetry: () => void;
}

export const MailchimpStatusBadge: React.FC<MailchimpStatusBadgeProps> = ({
  onRetry,
}) => {
  const { data, isLoading } = useMailchimpConnectionSummary();

  if (isLoading) {
    return null;
  }

  const getStatusDisplay = () => {
    switch (data.connectionStatus.trim().toLowerCase()) {
      case "connected":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: "Connected",
          className: "bg-green-500/10 text-green-600 border-green-500/20",
          showAction: false,
        };
      case "expired":
      case "error":
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          label:
            data.connectionStatus.trim().toLowerCase() === "expired"
              ? "Expired"
              : "Error",
          className: "bg-destructive/10 text-destructive border-destructive/20",
          showAction: true,
        };
      case "revoked":
        return {
          icon: <ShieldAlert className="w-3.5 h-3.5" />,
          label: "Revoked",
          className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
          showAction: true,
        };
      case "pending":
        return {
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: "Pending",
          className: "bg-slate-100 text-slate-700 border-slate-200",
          showAction: true,
        };
      default:
        return {
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: "Not Connected",
          className: "bg-slate-100 text-slate-700 border-slate-200",
          showAction: true,
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const lastUpdated = data.lastActivityAt
    ? formatDistanceToNow(new Date(data.lastActivityAt), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`flex items-center gap-1.5 ${statusDisplay.className}`}
        >
          {statusDisplay.icon}
          {statusDisplay.label}
        </Badge>
        {data.isImportRunning && (
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-primary/20 bg-primary/10 text-primary"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Syncing
          </Badge>
        )}
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">{lastUpdated}</span>
        )}
      </div>

      {statusDisplay.showAction && (
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {data.hasConnection ? "Open Mailchimp" : "Connect Mailchimp"}
          </Button>
        </div>
      )}
    </div>
  );
};
