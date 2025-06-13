
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Coins, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { useTokens } from "@/hooks/useTokens";
import { format, formatDistanceToNow } from "date-fns";

export const TokenUsageDashboard = () => {
  const { tokenBalance, tokenUsage, loading, getOverageAmount, getOverageCost } = useTokens();

  if (loading) {
    return (
      <div className="grid gap-6">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  if (!tokenBalance) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Unable to load token information</p>
        </CardContent>
      </Card>
    );
  }

  const isInOverage = tokenBalance.tokens_balance < 0;
  const overageAmount = getOverageAmount();
  const overageCost = getOverageCost();
  const baseAllowance = 100;
  const progressValue = isInOverage ? 0 : (tokenBalance.tokens_balance / baseAllowance) * 100;

  const getActionTypeIcon = (actionType: string) => {
    switch (actionType) {
      case 'generation': return '🎯';
      case 'refill': return '🔄';
      case 'overage_charge': return '💳';
      default: return '📝';
    }
  };

  const getContentTypeIcon = (contentType: string | null) => {
    switch (contentType) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'email': return '📧';
      case 'newsletter': return '📰';
      case 'video': return '🎥';
      default: return '📝';
    }
  };

  return (
    <div className="grid gap-6">
      {/* Token Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="w-4 h-4 text-green-600" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isInOverage ? 0 : tokenBalance.tokens_balance}
              <span className="text-sm font-normal text-gray-500 ml-1">
                / {baseAllowance}
              </span>
            </div>
            <Progress value={progressValue} className="mt-2 h-2" />
            {tokenBalance.is_trial && (
              <Badge variant="outline" className="mt-2">
                Trial Account
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Next Reset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDistanceToNow(new Date(tokenBalance.tokens_reset_at))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {format(new Date(tokenBalance.tokens_reset_at), 'MMM d, yyyy')}
            </p>
          </CardContent>
        </Card>

        <Card className={isInOverage ? "border-orange-200 bg-orange-50" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${isInOverage ? 'text-orange-600' : 'text-gray-400'}`} />
              Overage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isInOverage ? (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  +{overageAmount}
                  <span className="text-sm font-normal ml-1">tokens</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  ${overageCost.toFixed(2)} at $0.25/token
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-gray-400">$0.00</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Token Usage
          </CardTitle>
          <CardDescription>
            Your token consumption over the last 50 activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tokenUsage.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No token usage yet</p>
            ) : (
              tokenUsage.map((usage) => (
                <div key={usage.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {getActionTypeIcon(usage.action_type)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {usage.action_type}
                        </span>
                        {usage.content_type && (
                          <div className="flex items-center gap-1">
                            <span>{getContentTypeIcon(usage.content_type)}</span>
                            <span className="text-sm text-gray-600 capitalize">
                              {usage.content_type}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {format(new Date(usage.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${usage.action_type === 'refill' ? 'text-green-600' : 'text-red-600'}`}>
                      {usage.action_type === 'refill' ? '+' : '-'}{usage.tokens_consumed}
                    </div>
                    <div className="text-xs text-gray-500">
                      Balance: {usage.tokens_remaining}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
