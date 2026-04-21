import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Wifi, WifiOff, AlertCircle, Clock, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { POSProvider } from "./providers";
import type { POSConnectionStatus } from "@/hooks/useUnifiedPOSConnections";

// Import logos statically so Vite resolves them
import squareLogo from "@/assets/logos/square-new.png";
import lightspeedLogo from "@/assets/logos/lightspeed-x-series.svg";
import cloverLogo from "@/assets/logos/clover.svg";

const logoMap: Record<string, string> = {
  square: squareLogo,
  lightspeed: lightspeedLogo,
  clover: cloverLogo,
};

interface ProviderCardProps {
  provider: POSProvider;
  connection: POSConnectionStatus;
  onConnect: (providerId: string) => void;
  onManage: (providerId: string) => void;
}

const statusConfig: Record<
  POSConnectionStatus["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  connected: { label: "Connected", variant: "default", icon: <Wifi className="h-3 w-3" /> },
  syncing: { label: "Syncing", variant: "secondary", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  error: { label: "Error", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
  paused: { label: "Paused", variant: "outline", icon: <Pause className="h-3 w-3" /> },
  not_connected: { label: "Not connected", variant: "outline", icon: <WifiOff className="h-3 w-3" /> },
};

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  connection,
  onConnect,
  onManage,
}) => {
  const logo = logoMap[provider.id];
  const st = statusConfig[connection.status];
  const isComingSoon = provider.connectMethod === "coming_soon";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Logo or icon */}
          <div className="flex items-center gap-3">
            {logo ? (
              <img
                src={logo}
                alt={provider.name}
                className="h-10 w-10 object-contain rounded"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {provider.description}
              </CardDescription>
            </div>
          </div>

          {/* Status badge */}
          {!isComingSoon && (
            <Badge
              variant={st.variant}
              className={cn(
                "flex-shrink-0 gap-1",
                connection.status === "connected" && "bg-green-100 text-green-800 border-green-200",
                connection.status === "syncing" && "bg-amber-100 text-amber-800 border-amber-200",
              )}
            >
              {st.icon}
              {st.label}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 pt-0">
        {/* Last sync info */}
        {connection.lastSyncAt && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
            <Clock className="h-3 w-3" />
            Last synced {formatDistanceToNow(new Date(connection.lastSyncAt), { addSuffix: true })}
          </p>
        )}

        {/* Error message */}
        {connection.status === "error" && connection.errorMessage && (
          <p className="text-xs text-red-600 mb-3 line-clamp-2">
            {connection.errorMessage}
          </p>
        )}

        {/* Action button — pushed to bottom */}
        <div className="mt-auto pt-2">
          {isComingSoon ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              Coming soon
            </Button>
          ) : connection.status === "not_connected" ? (
            <Button size="sm" className="w-full" onClick={() => onConnect(provider.id)}>
              Connect
            </Button>
          ) : connection.status === "error" ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => onConnect(provider.id)}
            >
              Fix connection
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => onManage(provider.id)}>
              Manage
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
