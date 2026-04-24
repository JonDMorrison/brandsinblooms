import Box from '@mui/joy/Box';
import Chip from '@mui/joy/Chip';
import Divider from '@mui/joy/Divider';
import Sheet from '@mui/joy/Sheet';
import Skeleton from '@mui/joy/Skeleton';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import {
  Droplets,
  Leaf,
  Mountain,
  RefreshCw,
  Snowflake,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { JoyButton } from '@/components/joy/JoyButton';
import { JoyEmptyState } from '@/components/joy/JoyEmptyState';

interface ClimateProfileCardProps {
  isLoading?: boolean;
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
      return <Sun className="h-5 w-5" />;
    case 'hot_humid':
      return <Droplets className="h-5 w-5" />;
    case 'subtropical':
      return <Droplets className="h-5 w-5" />;
    case 'mediterranean':
      return <Sun className="h-5 w-5" />;
    case 'temperate':
      return <Leaf className="h-5 w-5" />;
    case 'cool_wet':
      return <Wind className="h-5 w-5" />;
    case 'cold':
      return <Snowflake className="h-5 w-5" />;
    case 'coastal':
      return <Wind className="h-5 w-5" />;
    case 'mountain':
      return <Mountain className="h-5 w-5" />;
    default:
      return <Thermometer className="h-5 w-5" />;
  }
};

const getConfidenceChip = (confidence: string | null | undefined) => {
  switch (confidence) {
    case 'high':
      return <Chip color="success" size="sm" variant="soft">High Confidence</Chip>;
    case 'medium':
      return <Chip color="warning" size="sm" variant="soft">Medium Confidence</Chip>;
    case 'low':
      return <Chip color="danger" size="sm" variant="soft">Low Confidence</Chip>;
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
    case 'subtropical':
      return 'Long warm seasons support lush growth, but moisture, airflow, and heat stress still need active management.';
    case 'mediterranean':
      return 'Dry summers and mild wet winters favor deep watering, drainage planning, and seasonal drought resilience.';
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

const formatArchetypeLabel = (value: string | null | undefined) => {
  if (!value) {
    return 'Climate profile';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatSourceLabel = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

function ClimateProfileSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 'xl', bgcolor: 'background.surface' }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Stack spacing={1}>
            <Skeleton animation="wave" sx={{ width: 150, height: 18 }} variant="text" />
            <Skeleton animation="wave" sx={{ width: 240, height: 14 }} variant="text" />
          </Stack>
          <Skeleton animation="wave" sx={{ width: 112, height: 34, borderRadius: 'lg' }} variant="rectangular" />
        </Stack>

        <Sheet variant="soft" sx={{ p: 2.5, borderRadius: 'lg' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Skeleton animation="wave" sx={{ width: 48, height: 48, borderRadius: 'xl', flexShrink: 0 }} variant="rectangular" />
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Skeleton animation="wave" sx={{ width: 180, height: 20 }} variant="text" />
              <Skeleton animation="wave" sx={{ width: '100%', height: 16 }} variant="text" />
              <Skeleton animation="wave" sx={{ width: '80%', height: 16 }} variant="text" />
            </Stack>
          </Stack>
        </Sheet>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Sheet key={index} variant="soft" sx={{ p: 2, borderRadius: 'lg' }}>
              <Stack spacing={0.75}>
                <Skeleton animation="wave" sx={{ width: 84, height: 12 }} variant="text" />
                <Skeleton animation="wave" sx={{ width: 96, height: 18 }} variant="text" />
              </Stack>
            </Sheet>
          ))}
        </Box>

        <Skeleton animation="wave" sx={{ width: 260, height: 14 }} variant="text" />
      </Stack>
    </Sheet>
  );
}

export const ClimateProfileCard: React.FC<ClimateProfileCardProps> = ({
  isLoading = false,
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
  const resolvedClimateLabel = climateLabel || formatArchetypeLabel(climateArchetype);
  const sourceLabel = formatSourceLabel(climateSource);

  const formatFrostDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Unknown';
    try {
      return format(new Date(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return <ClimateProfileSkeleton />;
  }

  return (
    <Sheet variant="outlined" sx={{ p: { xs: 3, md: 3.5 }, borderRadius: 'xl', bgcolor: 'background.surface' }}>
      <Stack spacing={2.5}>
        {hasClimateData ? (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
            >
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  <Typography level="title-lg">Climate Profile</Typography>
                  {getConfidenceChip(climateConfidence)}
                </Stack>
                <Typography level="body-sm" sx={{ color: 'neutral.500' }}>
                  Derived from your confirmed location to guide seasonal and climate-aware recommendations.
                </Typography>
              </Stack>
              <JoyButton
                color="neutral"
                loading={isRefreshing}
                loadingPosition="start"
                onClick={() => {
                  void onRefresh();
                }}
                startDecorator={!isRefreshing ? <RefreshCw className="h-4 w-4" /> : undefined}
                variant="plain"
              >
                Refresh climate profile
              </JoyButton>
            </Stack>

            <Sheet variant="soft" sx={{ p: 2.5, borderRadius: 'lg' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 'xl',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'background.surface',
                    color: 'neutral.600',
                    flexShrink: 0,
                    '& .lucide': {
                      width: 24,
                      height: 24,
                    },
                  }}
                >
                  {getClimateIcon(climateArchetype)}
                </Box>

                <Stack spacing={0.75}>
                  <Typography level="title-md">{resolvedClimateLabel}</Typography>
                  <Typography level="body-sm" sx={{ color: 'neutral.700' }}>
                    {getArchetypeDescription(climateArchetype)}
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {usdaZone && (
                <MetricCard label="USDA Zone" value={usdaZone} />
              )}

              {hasFrostDates && (
                <>
                  <MetricCard label="Last Frost" value={formatFrostDate(lastFrostDate)} />
                  <MetricCard label="First Frost" value={formatFrostDate(firstFrostDate)} />
                </>
              )}
            </Box>

            {(sourceLabel || climateLastUpdatedAt) ? (
              <Typography level="body-xs" sx={{ color: 'neutral.500' }}>
                {sourceLabel ? `Source: ${sourceLabel}` : ''}
                {sourceLabel && climateLastUpdatedAt ? ' • ' : ''}
                {climateLastUpdatedAt
                  ? `Last updated ${formatDistanceToNow(new Date(climateLastUpdatedAt), {
                      addSuffix: true,
                    })}`
                  : ''}
              </Typography>
            ) : null}
          </>
        ) : (
          <>
            <Stack spacing={0.5}>
              <Typography level="title-lg">Climate Profile</Typography>
              <Typography level="body-sm" sx={{ color: 'neutral.500' }}>
                Generate a climate snapshot once your location is confirmed.
              </Typography>
            </Stack>
            <Divider />
            <JoyEmptyState
              icon={<Thermometer />}
              title="No climate profile yet"
              description="Generate your climate snapshot to personalize plant recommendations, frost timing, and seasonal guidance for your business."
              primaryAction={{
                label: 'Generate Climate Profile',
                loading: isRefreshing,
                loadingPosition: 'start',
                onClick: () => {
                  void onRefresh();
                },
                startDecorator: !isRefreshing ? <RefreshCw className="h-4 w-4" /> : undefined,
                variant: 'solid',
              }}
            />
          </>
        )}
      </Stack>
    </Sheet>
  );
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Sheet variant="soft" sx={{ p: 2, borderRadius: 'lg' }}>
      <Stack spacing={0.5}>
        <Typography level="body-xs" sx={{ color: 'neutral.500' }}>
          {label}
        </Typography>
        <Typography level="title-sm">{value}</Typography>
      </Stack>
    </Sheet>
  );
}
