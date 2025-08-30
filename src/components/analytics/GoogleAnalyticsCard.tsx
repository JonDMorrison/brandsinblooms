import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, Eye, MousePointer } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";

interface GoogleAnalyticsCardProps {
  propertyId?: string;
  dateRange?: number;
}

export const GoogleAnalyticsCard = ({ propertyId, dateRange = 30 }: GoogleAnalyticsCardProps) => {
  const { data, loading, error } = useGoogleAnalytics(propertyId, dateRange);

  if (!propertyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Website Analytics
            <Badge variant="outline">Setup Required</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Connect Google Analytics to view website traffic data.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Website Analytics
            <Badge variant="outline">Loading...</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Website Analytics
            <Badge variant="destructive">Error</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const metrics = [
    {
      icon: Users,
      label: 'Total Users',
      value: formatNumber(data.overview.totalUsers),
      color: 'text-blue-600'
    },
    {
      icon: Eye,
      label: 'Page Views',
      value: formatNumber(data.overview.totalPageviews),
      color: 'text-green-600'
    },
    {
      icon: MousePointer,
      label: 'Sessions',
      value: formatNumber(data.overview.totalSessions),
      color: 'text-purple-600'
    },
    {
      icon: Globe,
      label: 'Countries',
      value: data.topCountries.length.toString(),
      color: 'text-orange-600'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Website Analytics
          <Badge variant="outline">{dateRange} days</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <div key={index} className="text-center p-3 bg-muted/50 rounded-lg">
              <metric.icon className={`w-5 h-5 mx-auto mb-2 ${metric.color}`} />
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Traffic Chart */}
        <div>
          <h4 className="text-sm font-medium mb-3">Daily Traffic</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value, name) => [formatNumber(value as number), name]}
              />
              <Line 
                type="monotone" 
                dataKey="sessions" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Sessions"
              />
              <Line 
                type="monotone" 
                dataKey="users" 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                name="Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Countries & Devices */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Top Countries</h4>
            <div className="space-y-2">
              {data.topCountries.slice(0, 5).map((country, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span>{country.country}</span>
                  <span className="font-medium">{formatNumber(country.sessions)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3">Device Types</h4>
            <div className="space-y-2">
              {data.deviceBreakdown.map((device, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="capitalize">{device.device}</span>
                  <span className="font-medium">{formatNumber(device.sessions)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};