import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Thermometer,
  RefreshCw,
  Snowflake,
  Sun,
  Droplets,
  Mountain,
  Wind,
  Leaf,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ClimateProfileCardProps {
  climateArchetype?: string | null;
  climateLabel?: string | null;
  climateConfidence?: string | null;
  climateSource?: string | null;
  climateLastUpdatedAt?: string | null;
  usdaZone?: string | null;
  firstFrostDate?: string | null;
  lastFrostDate?: string | null;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

const getClimateIcon = (archetype: string | null | undefined) => {
  switch (archetype) {
    case 'hot_dry':
      return <Sun className="h-5 w-5 text-orange-500" />;
    case 'hot_humid':
      return <Droplets className="h-5 w-5 text-blue-500" />;
    case 'temperate':
      return <Leaf className="h-5 w-5 text-green-500" />;
    case 'cool_wet':
      return <Wind className="h-5 w-5 text-teal-500" />;
    case 'cold':
      return <Snowflake className="h-5 w-5 text-blue-400" />;
    case 'coastal':
      return <Wind className="h-5 w-5 text-cyan-500" />;
    case 'mountain':
      return <Mountain className="h-5 w-5 text-slate-600" />;
    default:
      return <Thermometer className="h-5 w-5 text-muted-foreground" />;
  }
};

const getConfidenceBadge = (confidence: string | null | undefined) => {
  switch (confidence) {
    case 'high':
      return <Badge className="bg-green-100 text-green-800 border-green-200">High Confidence</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium Confidence</Badge>;
    case 'low':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Low Confidence</Badge>;
    default:
      return null;
  }
};

const getArchetypeDescription = (archetype: string | null | undefined): string => {
  switch (archetype) {
    case 'hot_dry':
      return 'Xeriscaping, drought-tolerant plants, efficient irrigation. Avoid water-hungry species.';
    case 'hot_humid':
      return 'Tropicals, heat-tolerant varieties. Watch for fungal issues and high humidity stress.';
    case 'temperate':
      return 'Wide variety of plants thrive. Standard seasonal care with moderate watering.';
    case 'cool_wet':
      return 'Shade-tolerant, moisture-loving plants. Rain gardens, native ferns. Watch for root rot.';
    case 'cold':
      return 'Hardy perennials, cold-tolerant varieties. Short growing season, frost protection needed.';
    case 'coastal':
      return 'Salt-tolerant, wind-resistant plants. Cool summers, mild winters. Marine influence.';
    case 'mountain':
      return 'Alpine varieties, high-altitude adaptation. Intense sun, cool nights, quick drainage.';
    default:
      return 'Climate profile not yet determined. Refresh to derive from your location.';
  }
};

export const ClimateProfileCard: React.FC<ClimateProfileCardProps> = ({
  climateArchetype,
  climateLabel,
  climateConfidence,
  climateSource,
  climateLastUpdatedAt,
  usdaZone,
  firstFrostDate,
  lastFrostDate,
  onRefresh,
  isRefreshing = false,
}) => {
  const hasClimateData = climateArchetype || climateLabel;
  const hasFrostDates = firstFrostDate || lastFrostDate;

  const formatFrostDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown';
    try {
      return format(new Date(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className={cn(
      "transition-colors",
      hasClimateData ? "border-green-200 bg-green-50/30" : "border-yellow-200 bg-yellow-50/30"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getClimateIcon(climateArchetype)}
          Climate Profile
          {climateConfidence && getConfidenceBadge(climateConfidence)}
        </CardTitle>
        {!hasClimateData && (
          <CardDescription className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-4 w-4" />
            Climate profile not yet derived. Click refresh to generate.
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {hasClimateData ? (
          <>
            {/* Main climate info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  {climateLabel || climateArchetype?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {getArchetypeDescription(climateArchetype)}
              </p>
            </div>

            {/* Additional data grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {usdaZone && (
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-xs text-muted-foreground">USDA Zone</p>
                  <p className="font-semibold">{usdaZone}</p>
                </div>
              )}
              
              {hasFrostDates && (
                <>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground">Last Frost</p>
                    <p className="font-semibold">{formatFrostDate(lastFrostDate)}</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-xs text-muted-foreground">First Frost</p>
                    <p className="font-semibold">{formatFrostDate(firstFrostDate)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
              {climateSource && (
                <span>Source: {climateSource}</span>
              )}
              {climateLastUpdatedAt && (
                <span>Updated: {format(new Date(climateLastUpdatedAt), 'MMM d, yyyy')}</span>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your climate profile helps generate location-appropriate content recommendations
            for plants, gardening tips, and seasonal advice.
          </p>
        )}

        {/* Refresh button */}
        <Button
          variant={hasClimateData ? "outline" : "default"}
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          {isRefreshing ? 'Refreshing...' : hasClimateData ? 'Refresh Climate Profile' : 'Generate Climate Profile'}
        </Button>
      </CardContent>
    </Card>
  );
};
