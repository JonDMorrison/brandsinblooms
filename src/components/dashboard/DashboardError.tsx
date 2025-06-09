
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface DashboardErrorProps {
  onRetry: () => void;
}

export const DashboardError = ({ onRetry }: DashboardErrorProps) => {
  return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md w-full border-destructive/20">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold text-destructive mb-2">Dashboard Error</h2>
          <p className="text-destructive/80 mb-6">
            We encountered an issue loading your dashboard. This might be a temporary problem.
          </p>
          <Button 
            onClick={onRetry} 
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
