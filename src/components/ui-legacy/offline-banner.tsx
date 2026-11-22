
import { Alert, AlertDescription } from "@/components/ui-legacy/alert";
import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export const OfflineBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <Alert className={`fixed top-0 left-0 right-0 z-50 rounded-none border-x-0 border-t-0 ${
      isOnline ? 'bg-blue-50 border-blue-200 text-blue-950' : 'bg-orange-50 border-orange-200 text-orange-800'
    }`}>
      <div className="flex items-center gap-2">
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <AlertDescription className="font-medium">
          {isOnline 
            ? 'Connection restored! The app will reload to sync latest data.'
            : 'You are currently offline. Some features may be limited.'
          }
        </AlertDescription>
      </div>
    </Alert>
  );
};
